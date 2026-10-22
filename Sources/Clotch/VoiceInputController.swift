import AVFoundation
import SwiftUI
import os.log
import ClotchCore

/// Voice in (#110): one shortcut, press to speak, press again to finish. Microphone → Scribe v2 Realtime or Parakeet on the Mac
/// (`VoiceInput.Config`, from the «Voce» page) → text on the pill while Roberto speaks → `VoiceRoute.classify`: a question is answered
/// aloud by a read-only model (`VoiceAsk`), an order waits `cancelSeconds` for an «Annulla» and goes to the Overseer (`OverseerDelivery`).
/// The pill follows the Figma design of #110 (`VoiceInputPill`, light on the outline: `VoiceInputLight`).
@MainActor
final class VoiceInputController: ObservableObject {
    static let shared = VoiceInputController()
    nonisolated private static let log = Logger(subsystem: "com.squadd.clotch", category: "VoiceInput")

    enum Phase: Equatable { case idle, ready, listening, finishing, thinking, sending, failure(VoiceInput.Failure), result(String) }
    /// The light on the island's outline: white and steady while he speaks, red and fast on an error, none otherwise.
    enum Light { case off, white, red }

    /// Seconds an order can still be taken back, before it leaves.
    static let cancelSeconds = 2.0

    @Published private(set) var phase: Phase = .idle { didSet { Self.log.notice("phase \(String(String(describing: self.phase).prefix(60)), privacy: .public)") } }
    /// The microphone's last levels (0…1), newest last: the bars of the pill.
    @Published private(set) var levels = [Double](repeating: 0, count: 8)
    @Published private(set) var sure = ""
    @Published private(set) var maybe = ""
    @Published private(set) var startedAt = Date()
    /// When the order started to wait for its «Annulla».
    @Published private(set) var sendingSince = Date()
    /// One line while the local model is not ready yet.
    @Published private(set) var hint: String?

    var text: String { [sure, maybe].filter { !$0.isEmpty }.joined(separator: " ") }
    var light: Light {
        switch phase {
        case .listening, .finishing: return .white
        case .failure: return .red
        default: return .off
        }
    }
    /// «ElevenLabs · italiano»: what is listening and in which language.
    var engineLabel: String {
        let name = config.language == "auto" ? "automatica" : (VoiceInput.languages.first { $0.code == config.language }?.name.lowercased() ?? config.language)
        return (config.engine == .scribe ? "ElevenLabs" : "Parakeet") + " · " + name
    }

    /// `--snapshot --gallery` only: a controller held at one state of the pill, for the Figma comparison.
    static func still(_ phase: Phase, sure: String = "", maybe: String = "", levels: [Double] = [], elapsed: TimeInterval = 0) -> VoiceInputController {
        let c = VoiceInputController()
        c.phase = phase
        c.sure = sure
        c.maybe = maybe
        if !levels.isEmpty { c.levels = levels }
        c.startedAt = Date().addingTimeInterval(-elapsed)
        c.sendingSince = Date().addingTimeInterval(-elapsed)
        return c
    }

    let files = VoiceFiles()
    var config = VoiceInput.Config([:])
    private let local = LocalTranscriber()
    private var capture: VoiceCapture?
    private var scribe: ScribeSession?
    private var feed: AsyncStream<AVAudioPCMBuffer>.Continuation?
    private var feeding: Task<Void, Never>?
    private var dictation = VoiceInput.Dictation()
    private var scribeCommitted = false
    /// Hold mode: the key is still down. `begin` looks at it once the microphone runs, in case it went up while macOS asked.
    private var holds = false
    private var pressedAt = Date.distantPast
    private var releasedAt: Date?
    static let tap: TimeInterval = 0.35
    /// Hold mode and the key went up after a real hold (not a tap).
    private var heldLong: Bool { releasedAt.map { $0.timeIntervalSince(pressedAt) >= Self.tap } ?? false }
    var timers: [Task<Void, Never>] = []
    var escapeID: UInt32?
    /// Every utterance has its number: a late event of a finished one changes nothing.
    var run = 0

    /// The key went down. Idle: starts. Open: ends it (press mode, or a quick tap in hold mode). Thinking or waiting to send: nothing
    /// (Esc and «Annulla» take it back). «Dettatura accesa» off: nothing at all.
    func press() {
        let current = VoiceInput.Config((try? files.readConfig()) ?? [:])
        Self.log.notice("press: enabled \(current.enabled) phase \(String(describing: self.phase)) mic \(AVCaptureDevice.authorizationStatus(for: .audio).rawValue)")
        guard current.enabled else { return }
        switch phase {
        case .idle, .result, .failure:
            holds = current.mode == .hold
            pressedAt = Date()
            releasedAt = nil
            Task { await begin() }
        case .ready, .listening: finish()
        case .finishing, .thinking, .sending: break
        }
    }

    /// The key went up: in hold mode that ends the utterance. A tap shorter than `tap` keeps it open instead, to end with the next press.
    func release() {
        guard holds else { return }
        holds = false
        releasedAt = Date()
        if heldLong, phase == .ready || phase == .listening { finish() }
    }

    /// Esc, «annulla»: whatever is happening stops and nothing is sent.
    func cancel() {
        guard phase != .idle else { return }
        abort()
    }

    // MARK: - Listening

    func begin() async {
        reset()
        run += 1
        let me = run
        config = VoiceInput.Config((try? files.readConfig()) ?? [:])
        let key = files.key
        if config.engine == .scribe, key == nil { return show(failure: .key) }
        phase = .ready
        armEscape()
        guard await VoiceCapture.authorized() else { return show(failure: .mic) }
        guard me == run, phase == .ready else { return }  // pressed again while macOS asked: finished or aborted already
        let capture = VoiceCapture(microphone: config.microphone)
        let meter: @Sendable (Double) -> Void = { l in Task { @MainActor [weak self] in self?.push(l) } }
        switch config.engine {
        case .scribe:
            let s = ScribeSession()
            s.onEvent = { event in Task { @MainActor [weak self] in self?.scribeEvent(event, run: me) } }
            s.open(key: key ?? "", language: config.language)
            scribe = s
            capture.onAudio = { _, pcm in s.send(pcm); meter(VoiceInput.level(pcm16: pcm)) }
        case .local:
            let (stream, continuation) = AsyncStream<AVAudioPCMBuffer>.makeStream()
            feed = continuation
            capture.onAudio = { buffer, pcm in continuation.yield(buffer); meter(VoiceInput.level(pcm16: pcm)) }
            feeding = Task { [local] in
                // The model loads while the microphone already runs: its first buffers wait in the stream.
                if !(await local.isLoaded) { hint = "Scarico il modello. Succede solo la prima volta." }
                do { try await local.start { text in Task { @MainActor [weak self] in self?.localText(text, run: me) } } } catch {
                    return fail(.local, run: me)
                }
                hint = nil
                for await buffer in stream { await local.feed(buffer) }
            }
        }
        do { try capture.start() } catch { return fail(.mic, run: me) }
        self.capture = capture
        startedAt = Date()
        phase = .listening
        if heldLong { finish() }  // the key went up during the start
        timers.append(Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(VoiceInput.maxSeconds * 1e9))
            if !Task.isCancelled { self?.finish() }
        })
    }

    private var peak = 0.0, chunks = 0

    private func push(_ level: Double) {
        guard phase == .listening else { return }
        peak = max(peak, level); chunks += 1
        levels = Array(levels.dropFirst()) + [level]
    }

    private func scribeEvent(_ event: VoiceInput.ScribeEvent, run me: Int) {
        guard me == run else { return }
        if case .failure(let why) = event { return fail(why, run: me) }
        if case .committed = event { scribeCommitted = true }
        dictation.take(event)
        publishText()
    }

    private func localText(_ whole: String, run me: Int) {
        guard me == run else { return }
        dictation.replace(with: whole)
        publishText()
    }

    private func publishText() { (sure, maybe) = (dictation.sure, dictation.maybe) }

    // MARK: - Finishing

    private func finish() {
        guard phase == .ready || phase == .listening else { return }
        guard capture != nil else { return abort() }
        let me = run
        Self.log.notice("audio chunks \(self.chunks) peak \(self.peak)")
        capture?.stop()
        capture = nil
        timers.forEach { $0.cancel() }
        levels = [Double](repeating: 0, count: levels.count)
        phase = .finishing
        feed?.finish()
        Task {
            let said = await transcript()
            guard me == run else { return }
            await route(said, run: me)
        }
    }

    /// Scribe: the closing silence asks for the committed text, at most 3 s. Local: the model finishes what it holds.
    private func transcript() async -> String {
        switch config.engine {
        case .scribe:
            scribe?.commit()
            for _ in 0..<60 where !scribeCommitted && scribe != nil { try? await Task.sleep(nanoseconds: 50_000_000) }
            scribe?.close()
            scribe = nil
            return dictation.text
        case .local:
            await feeding?.value
            let final = await local.finish()
            return final.isEmpty ? dictation.text : final
        }
    }

    private func route(_ said: String, run me: Int) async {
        let said = said.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !said.isEmpty else { return show(failure: .silence) }
        (sure, maybe) = (said, "")
        // A short confirmation («va bene», «sì vai») may answer the Overseer: only a question is kept out of its chat.
        if VoiceRoute.classify(said) == .question {
            phase = .thinking
            let answer = await VoiceAsk.run(said)
            guard me == run else { return }
            guard let answer else { return show("Nessuna risposta. Riprova.") }
            if config.spoken { Task { _ = await VoiceSpeaker.shared.speakAnswer(answer) } }
            return show(answer, seconds: max(6, Double(answer.count) * 0.07))
        }
        sendingSince = Date()
        phase = .sending
        try? await Task.sleep(nanoseconds: UInt64(Self.cancelSeconds * 1e9))
        guard me == run, phase == .sending else { return }  // «Annulla» or Esc moved the run on
        disarmEscape()
        let outcome = await OverseerDelivery.send(said)
        guard me == run else { return }
        show(outcome == .sent ? "Inviato all’Overseer" : "Testo copiato. Incolla con ⌘V")
    }

    // MARK: - End

    private func fail(_ why: VoiceInput.Failure, run me: Int) {
        guard me == run else { return }
        abort()
        show(failure: why)
    }

    /// Stops everything and drops what the engines hold. Also the end of a press made before the microphone was ready.
    private func abort() {
        run += 1
        teardown()
        withAnimation(NotchAnimation.close) { phase = .idle }
        Task { [local] in await local.cancel() }
    }

    private func teardown() {
        capture?.stop()
        capture = nil
        scribe?.close()
        scribe = nil
        feed?.finish()
        feed = nil
        timers.forEach { $0.cancel() }
        timers = []
        feeding?.cancel()
        feeding = nil
        disarmEscape()
    }

    private func reset() {
        peak = 0; chunks = 0
        teardown()
        dictation = .init()
        scribeCommitted = false
        (sure, maybe) = ("", "")
        hint = nil
        levels = [Double](repeating: 0, count: levels.count)
    }

    /// A line on the pill for a while, then the pill folds away.
    func show(_ message: String, seconds: Double = 3) { end(.result(message), seconds: seconds) }

    /// Closes the engines and puts `next` on the pill for `seconds`.
    func end(_ next: Phase, seconds: Double) {
        teardown()
        timers.append(dismiss(after: seconds, whenStill: next))
        phase = next
    }

    func dismiss(after seconds: Double, whenStill expected: Phase) -> Task<Void, Never> {
        let me = run
        return Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1e9))
            guard !Task.isCancelled, let self, me == run, phase == expected else { return }
            withAnimation(NotchAnimation.close) { phase = .idle }
        }
    }
}
