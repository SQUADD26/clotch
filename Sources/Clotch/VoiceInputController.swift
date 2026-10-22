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
    private static let log = Logger(subsystem: "com.squadd.clotch", category: "VoiceInput")

    enum Phase: Equatable { case idle, ready, listening, finishing, thinking, sending, failure(VoiceInput.Failure), result(String) }
    /// The light on the island's outline: white and steady while he speaks, red and slow on an error (a soft rise, then a gentle breath, #145), none otherwise.
    enum Light { case off, white, red }

    /// Seconds an order can still be taken back, before it leaves.
    static let cancelSeconds = 2.0

    @Published private(set) var phase: Phase = .idle
    /// The microphone's last levels (0…1), newest last: the bars of the pill.
    @Published private(set) var levels = [Double](repeating: 0, count: 8)
    @Published private(set) var sure = ""
    @Published private(set) var maybe = ""
    @Published private(set) var startedAt = Date()
    /// When the order started to wait for its «Annulla».
    @Published private(set) var sendingSince = Date()
    /// One line while the local model is not ready yet.
    @Published private(set) var hint: String?

    /// The microphone is on or about to be: nothing else may speak.
    var micOpen: Bool { phase == .ready || phase == .listening || phase == .finishing }

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
    static func still(_ phase: Phase, files: VoiceFiles = VoiceFiles(), sure: String = "", maybe: String = "", levels: [Double] = [], elapsed: TimeInterval = 0) -> VoiceInputController {
        let c = VoiceInputController(files: files)
        c.phase = phase
        c.sure = sure
        c.maybe = maybe
        if !levels.isEmpty { c.levels = levels }
        c.startedAt = Date().addingTimeInterval(-elapsed)
        c.sendingSince = Date().addingTimeInterval(-elapsed)
        return c
    }

    let files: VoiceFiles
    var config = VoiceInput.Config([:])
    let local = LocalTranscriber()
    private var capture: VoiceCapture?
    /// The next utterance's microphone, already prepared: the first syllable is not lost to the start (#174).
    private var spare: VoiceCapture?
    /// The tests hand in a recorded voice instead of the microphone.
    var makeCapture: (String) -> VoiceCapture = { VoiceCapture(microphone: $0) }
    /// Says an answer aloud; the pilot's test hands in a recorder instead of the speaker.
    var speak: (String) async -> Void = { _ = await VoiceSpeaker.shared.speakAnswer($0) }
    /// The local engine's end and the most it may take (#197): the tests hand in a slow one.
    var finishLocal: (() async -> String)?
    var localWait = VoiceInput.commitWait
    private var audioSeconds = 0.0
    var scribe: ScribeSession?
    private var feed: AsyncStream<AVAudioPCMBuffer>.Continuation?
    var feeding: Task<Void, Never>?
    var dictation = VoiceInput.Dictation()
    var scribeCommitted = false
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

    init(files: VoiceFiles = VoiceFiles()) { self.files = files }

    /// At launch and after each utterance: the slow part of the microphone's start and the local model, done while nobody waits.
    func prewarm() {
        let current = VoiceInput.Config((try? files.readConfig()) ?? [:])
        if current.enabled, current.engine == .local { Task { [local] in try? await local.preload() } }
        guard current.enabled, spare?.microphone != current.microphone else { return }
        spare = makeCapture(current.microphone)
        spare?.prepare()
    }

    /// The key went down. Idle or thinking: starts. Open: ends it (press mode, or a quick tap in hold mode). Finishing or waiting to
    /// send: a new utterance too, never silence (#197). «Dettatura accesa» off: the pill says so (#198).
    func press() {
        let current = VoiceInput.Config((try? files.readConfig()) ?? [:])
        guard current.enabled else { return show(failure: .off) }
        Self.log.notice("press in \(String(describing: self.phase), privacy: .public)")
        switch phase {
        // Thinking: a new utterance is worth more than the answer still coming (it would only block the key).
        case .idle, .result, .failure, .thinking, .finishing, .sending:
            holds = current.mode == .hold
            pressedAt = Date()
            releasedAt = nil
            // At once, not in the task: a second press before the task runs ends this one (finish → abort), never starts a second (#174).
            run += 1
            phase = .ready
            let me = run
            Task { if me == run { await begin() } }
        case .ready, .listening: finish()
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
        let capture = spare?.microphone == config.microphone ? spare! : makeCapture(config.microphone)
        spare = nil
        guard await capture.authorized() else { return show(failure: .mic) }
        guard me == run, phase == .ready else { return }  // pressed again while macOS asked: finished or aborted already
        audioSeconds = 0
        let meter: @Sendable (Double) -> Void = { l in Task { @MainActor [weak self] in self?.push(l) } }
        let counted: @Sendable (AVAudioPCMBuffer) -> Void = { b in
            let s = Double(b.frameLength) / b.format.sampleRate
            Task { @MainActor [weak self] in if me == self?.run { self?.audioSeconds += s } }
        }
        switch config.engine {
        case .scribe:
            let s = ScribeSession()
            s.onEvent = { event in Task { @MainActor [weak self] in self?.scribeEvent(event, run: me) } }
            s.open(key: key ?? "", language: config.language)
            scribe = s
            capture.onAudio = { buffer, pcm in s.send(pcm); meter(VoiceInput.level(pcm16: pcm)); counted(buffer) }
        case .local:
            let (stream, continuation) = AsyncStream<AVAudioPCMBuffer>.makeStream()
            feed = continuation
            capture.onAudio = { buffer, pcm in continuation.yield(buffer); meter(VoiceInput.level(pcm16: pcm)); counted(buffer) }
            feeding = Task { [local] in
                // The model loads while the microphone already runs: its first buffers wait in the stream.
                if !(await local.isLoaded) { hint = "Scarico il modello. Succede solo la prima volta." }
                do { try await local.start(language: config.language) { text in Task { @MainActor [weak self] in self?.localText(text, run: me) } } } catch {
                    return fail(.local, run: me)
                }
                hint = nil
                for await buffer in stream { await local.feed(buffer) }
            }
        }
        do { try capture.start() } catch { return fail(.mic, run: me) }
        self.capture = capture
        Self.log.notice("listening: microphone on \(Int(Date().timeIntervalSince(self.pressedAt) * 1000)) ms after the press, engine \(self.config.engine.rawValue, privacy: .public)")
        startedAt = Date()
        phase = .listening
        if heldLong { finish() }  // the key went up during the start
        timers.append(Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(VoiceInput.maxSeconds * 1e9))
            if !Task.isCancelled { self?.finish() }
        })
    }

    private func push(_ level: Double) {
        guard phase == .listening else { return }
        levels = Array(levels.dropFirst()) + [level]
    }

    func publishText() { (sure, maybe) = (dictation.sure, dictation.maybe) }

    // MARK: - Finishing

    /// The second press: the microphone keeps going `VoiceInput.tailSeconds` (the word being said, the audio still on its way),
    /// then everything heard until then is transcribed. Nothing captured is dropped (#174).
    private func finish() {
        guard phase == .ready || phase == .listening else { return }
        guard capture != nil else { return abort() }
        let me = run
        timers.forEach { $0.cancel() }
        levels = [Double](repeating: 0, count: levels.count)
        phase = .finishing
        let stopped = Date()
        Task {
            try? await Task.sleep(nanoseconds: UInt64(VoiceInput.tailSeconds * 1e9))
            guard me == run else { return }
            capture?.stop()
            capture = nil
            feed?.finish()
            let said = VoiceInput.fixNames(await transcript())  // #242: «Allover Saird» → «all'Overseer»
            guard me == run else { return }
            Self.log.notice("transcript: \(String(format: "%.1f", self.audioSeconds), privacy: .public) s of audio, \(said.split(separator: " ").count) words in \(Int(Date().timeIntervalSince(stopped) * 1000)) ms: \(said, privacy: .public)")
            await route(said, run: me)
        }
    }

    func route(_ said: String, run me: Int) async {
        let said = said.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !said.isEmpty else { return abort() }  // not speaking is a choice, not an error (#147)
        (sure, maybe) = (said, "")
        // A short confirmation («va bene», «sì vai») may answer the Overseer: only a question is kept out of its chat.
        let isQuestion = VoiceRoute.classify(said) == .question
        let helper = VoiceAsk.helperPrompt()  // claude-config#2116: the helper answers and acts; an order still waits for «Annulla»
        Self.log.notice("route: \(isQuestion ? "question" : "order", privacy: .public), helper \(helper != nil, privacy: .public)")
        if isQuestion {
            phase = .thinking
            let reply = await VoiceAsk.run(said, helper: helper)
            guard me == run else { return }
            guard case .success(let answer) = reply else {
                if case .failure(let why) = reply { show(why.message, seconds: 5) }
                return
            }
            if config.spoken { Task { [speak] in await speak(answer) } }
            return show(answer, seconds: max(6, Double(answer.count) * 0.07))
        }
        sendingSince = Date()
        phase = .sending
        try? await Task.sleep(nanoseconds: UInt64(Self.cancelSeconds * 1e9))
        guard me == run, phase == .sending else { return }  // «Annulla» or Esc moved the run on
        disarmEscape()
        if let helper {
            phase = .thinking
            let reply = await VoiceAsk.run(said, helper: helper)
            guard me == run else { return }
            if case .success(let answer) = reply {
                if config.spoken { Task { [speak] in await speak(answer) } }
                return show(answer, seconds: max(6, Double(answer.count) * 0.07))
            }
            // shortcut: a helper that acted and then timed out sends the order twice; the inbox keeps an order from being lost
            Self.log.notice("order: helper failed, inbox as before")
        }
        let outcome = await OverseerDelivery.send(said, files: files)
        guard me == run else { return }
        Self.log.notice("order: \(String(describing: outcome), privacy: .public)")
        show(outcome == .sent ? "Inviato all’Overseer" : outcome == .queued ? "In coda per l’Overseer" : "Testo copiato. Incolla con ⌘V")
    }

    func fail(_ why: VoiceInput.Failure, run me: Int) {
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
        prewarm()
    }

    private func reset() {
        teardown()
        dictation = .init()
        scribeCommitted = false
        (sure, maybe) = ("", "")
        hint = nil
        levels = [Double](repeating: 0, count: levels.count)
    }

    /// Closes the engines and puts `next` on the pill for `seconds`.
    func end(_ next: Phase, seconds: Double) {
        teardown()
        timers.append(dismiss(after: seconds, whenStill: next))
        phase = next
        Self.log.notice("pill: \(Self.label(next), privacy: .public) for \(seconds, privacy: .public) s")  // #228: how long the red light lasts
    }

    func dismiss(after seconds: Double, whenStill expected: Phase) -> Task<Void, Never> {
        let me = run
        return Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1e9))
            guard !Task.isCancelled, let self, me == run, phase == expected else { return }
            withAnimation(NotchAnimation.close) { phase = .idle }
            Self.log.notice("pill: idle after \(Self.label(expected), privacy: .public)")
        }
    }
}
