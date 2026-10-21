import AVFoundation
import SwiftUI
import ClotchCore

/// Voice in (#110): one shortcut, press to speak, press again to finish. Microphone → Scribe v2 Realtime or Parakeet on the Mac
/// (`VoiceInput.Config`, from the «Voce» page) → text on the pill while Roberto speaks → `VoiceRoute.classify`: a question is answered
/// aloud by a read-only model (`VoiceAsk`), an order goes to the Overseer (`OverseerDelivery`).
@MainActor
final class VoiceInputController: ObservableObject {
    static let shared = VoiceInputController()

    enum Phase: Equatable { case idle, listening, finishing, thinking, result(String) }

    @Published private(set) var phase: Phase = .idle
    /// 0…1, the microphone's level now.
    @Published private(set) var level = 0.0
    /// What Roberto has said so far; `hint` stands in until the first word.
    @Published private(set) var text = ""
    @Published private(set) var hint = Copy.listening

    enum Copy {
        static let listening = "Ti ascolto"
        static let finishing = "Trascrivo…"
        static let thinking = "Penso…"
        static let sending = "Invio all’Overseer…"
        static let sent = "Inviato all’Overseer"
        static let copied = "Testo copiato. Incolla con ⌘V"
        static let silence = "Non ho sentito niente"
        static let noKey = "Manca la chiave ElevenLabs. Mettila in Voce."
        static let noMic = "Microfono spento. Attivalo in Privacy e sicurezza."
        static let noAnswer = "Nessuna risposta. Riprova."
        static let localFirst = "Scarico il modello. Succede solo la prima volta."
        static let failed = "Non riesco ad ascoltare. Riprova."
    }

    private let files = VoiceFiles()
    private let local = LocalTranscriber()
    private var config = VoiceInput.Config([:])
    private var capture: VoiceCapture?
    private var scribe: ScribeSession?
    private var feed: AsyncStream<AVAudioPCMBuffer>.Continuation?
    private var feeding: Task<Void, Never>?
    private var dictation = VoiceInput.Dictation()
    private var scribeCommitted = false
    private var timers: [Task<Void, Never>] = []
    /// Every utterance has its number: a late event of a finished one changes nothing.
    private var run = 0

    /// The shortcut: starts, or ends the utterance. Pressed while it thinks: nothing.
    func toggle() {
        switch phase {
        case .idle, .result: Task { await begin() }
        case .listening: finish()
        case .finishing, .thinking: break
        }
    }

    // MARK: - Listening

    private func begin() async {
        reset()
        run += 1
        let me = run
        config = VoiceInput.Config((try? files.readConfig()) ?? [:])
        let key = files.key
        if config.engine == .scribe, key == nil { return show(Copy.noKey) }
        phase = .listening
        guard await VoiceCapture.authorized() else { return show(Copy.noMic) }
        guard me == run, phase == .listening else { return }  // pressed again while macOS asked: finished or aborted already
        let capture = VoiceCapture()
        let meter: @Sendable (Double) -> Void = { l in Task { @MainActor [weak self] in self?.level = l } }
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
                if !(await local.isLoaded) { hint = Copy.localFirst }
                do { try await local.start { text in Task { @MainActor [weak self] in self?.localText(text, run: me) } } } catch {
                    return fail(Copy.failed, run: me)
                }
                hint = Copy.listening
                for await buffer in stream { await local.feed(buffer) }
            }
        }
        do { try capture.start() } catch { return fail(Copy.noMic, run: me) }
        self.capture = capture
        timers.append(Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(VoiceInput.maxSeconds * 1e9))
            if !Task.isCancelled { self?.finish() }
        })
    }

    private func scribeEvent(_ event: VoiceInput.ScribeEvent, run me: Int) {
        guard me == run else { return }
        if case .failure(let message) = event { return fail(message, run: me) }
        if case .committed = event { scribeCommitted = true }
        dictation.take(event)
        text = dictation.text
    }

    private func localText(_ whole: String, run me: Int) {
        guard me == run else { return }
        dictation.replace(with: whole)
        text = dictation.text
    }

    // MARK: - Finishing

    private func finish() {
        guard phase == .listening else { return }
        guard capture != nil else { return abort() }
        let me = run
        capture?.stop()
        capture = nil
        timers.forEach { $0.cancel() }
        level = 0
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
        guard !said.isEmpty else { return show(Copy.silence) }
        text = said
        phase = .thinking
        hint = Copy.thinking
        // A short confirmation («va bene», «sì vai») may answer the Overseer: only a question is kept out of its chat.
        if VoiceRoute.classify(said) == .question {
            let answer = await VoiceAsk.run(said)
            guard me == run else { return }
            guard let answer else { return show(Copy.noAnswer) }
            if config.spoken { Task { _ = await VoiceSpeaker.shared.speakAnswer(answer) } }
            return show(answer, seconds: max(6, Double(answer.count) * 0.07))
        }
        hint = Copy.sending
        let outcome = await OverseerDelivery.send(said)
        guard me == run else { return }
        show(outcome == .sent ? Copy.sent : Copy.copied)
    }

    // MARK: - End

    private func fail(_ message: String, run me: Int) {
        guard me == run else { return }
        abort()
        show(message)
    }

    /// Stops everything and drops what the engines hold. Also the end of a press made before the microphone was ready.
    private func abort() {
        run += 1
        teardown()
        phase = .idle
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
        level = 0
    }

    private func reset() {
        teardown()
        dictation = .init()
        scribeCommitted = false
        text = ""
        hint = Copy.listening
    }

    /// A line on the pill for a while, then the pill folds away.
    private func show(_ message: String, seconds: Double = 3) {
        teardown()
        let me = run
        phase = .result(message)
        timers.append(Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1e9))
            guard !Task.isCancelled, let self, me == run, case .result = phase else { return }
            withAnimation(NotchAnimation.close) { phase = .idle }
        })
    }
}
