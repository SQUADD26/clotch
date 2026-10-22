import AVFoundation
import XCTest
@testable import Clotch
import ClotchCore

/// #174: press, press again: everything said until the second press is transcribed, the last word too, whatever the speed;
/// a quick double or triple press never leaves the bar stuck. A recorded voice (macOS `say`) stands in for the microphone,
/// the real Parakeet model transcribes it (Mac only, skipped where the model was never downloaded).
@MainActor
final class VoiceInputCaptureTests: XCTestCase {
    private var home: URL!

    override func setUp() async throws {
        home = FileManager.default.temporaryDirectory.appendingPathComponent("clotch-voce-\(UUID().uuidString)")
        let voce = home.appendingPathComponent(".config/voce")
        try FileManager.default.createDirectory(at: voce, withIntermediateDirectories: true)
        let config: [String: Any] = ["ingresso_acceso": true, "ingresso_motore": "locale", "ingresso_modo": "premi", "ingresso_lingua": "it"]
        try JSONSerialization.data(withJSONObject: config).write(to: voce.appendingPathComponent("config.json"))
    }

    override func tearDown() async throws { try? FileManager.default.removeItem(at: home) }

    // MARK: - Whole utterances through the real model

    func testStopInTheLastWordKeepsIt() async throws {
        let said = try await dictate("Manda il messaggio a Marco domani mattina", stopBeforeEnd: 0.25)
        XCTAssertTrue(said.contains("mattina"), said)
    }

    func testVeryShortUtteranceIsKept() async throws {
        let said = try await dictate("Sì vai", stopBeforeEnd: 0.1)
        XCTAssertTrue(said.contains("vai"), said)
    }

    func testLongUtteranceIsKeptWhole() async throws {
        let text = "Correggi la barra della dettatura in Clotch, poi controlla che la voce arrivi all'Overseer, "
            + "apri la pull request su dev e scrivi nel rapporto quanto tempo serve per accendere il microfono, alla fine chiudi tutto stasera"
        let said = try await dictate(text, stopBeforeEnd: 0.2)
        XCTAssertTrue(said.contains("correggi"), said)
        XCTAssertTrue(said.contains("stasera"), said)
    }

    /// The first utterance after launch: the model is already loaded, the text comes in under 1 s (it took 12 to 44 s on Roberto's Mac).
    func testFirstUtteranceAfterLaunchIsQuick() async throws {
        // An order, not a question: a question goes to «sto pensando» and runs `claude -p`, an order stops at «sending».
        let (c, voice) = controller(try Self.recorded("Chiudi le sessioni vecchie di stasera"))
        c.prewarm()
        let deadline = Date().addingTimeInterval(90)
        while !(await c.local.isLoaded), Date() < deadline { try await Task.sleep(nanoseconds: 100_000_000) }
        let loaded = await c.local.isLoaded
        XCTAssertTrue(loaded, "prewarm loads the model")
        c.press()
        try await waitFor { c.phase == .listening }
        try await waitFor(seconds: 30) { voice.playedSeconds >= 2.8 }
        let stopped = Date()
        c.press()
        try await waitFor(seconds: 60) { c.phase == .sending }
        let wait = Date().timeIntervalSince(stopped)
        XCTAssertLessThan(wait, 1, "text after the second press in \(wait) s")
        XCTAssertTrue(c.sure.lowercased().contains("sessioni"), c.sure)
        c.cancel()
    }

    // MARK: - Presses

    func testDoublePressBeforeTheMicrophoneEndsQuietly() async throws {
        let (c, voice) = controller(try Self.recorded("Ciao"))
        c.press()
        c.press()
        try await Task.sleep(nanoseconds: 300_000_000)
        XCTAssertEqual(c.phase, .idle)
        XCTAssertFalse(voice.started, "a second start would keep the microphone open")
    }

    func testTriplePressListensOnce() async throws {
        var made: [RecordedVoice] = []
        let buffers = try Self.recorded("Ciao")
        let c = VoiceInputController(files: VoiceFiles(home: home))
        c.makeCapture = { _ in let v = RecordedVoice(buffers); made.append(v); return v }
        c.press(); c.press(); c.press()
        try await waitFor { c.phase == .listening }
        try await Task.sleep(nanoseconds: 300_000_000)
        XCTAssertEqual(c.phase, .listening)
        XCTAssertEqual(made.filter(\.started).count, 1, "one microphone, not two")
        c.cancel()
        XCTAssertEqual(c.phase, .idle)
    }

    func testPressWhileThinkingStartsANewUtterance() async throws {
        let c = VoiceInputController.still(.thinking, files: VoiceFiles(home: home))
        c.makeCapture = { _ in RecordedVoice([]) }
        c.press()
        try await waitFor { c.phase == .listening }
        XCTAssertEqual(c.phase, .listening)
        c.cancel()
    }

    // MARK: - Every phase has an exit (#197)

    /// Roberto's 22/10: «press in listening», then the local engine's end never came back and the bar stayed on «Trascrivo» for 100 s.
    func testLocalEngineThatNeverFinishesEndsWithAnError() async throws {
        let c = VoiceInputController(files: VoiceFiles(home: home))
        c.makeCapture = { _ in RecordedVoice([]) }
        c.finishLocal = { try? await Task.sleep(nanoseconds: 600_000_000_000); return "" }
        c.localWait = 1
        c.press()
        try await waitFor { c.phase == .listening }
        c.press()
        XCTAssertEqual(c.phase, .finishing)
        try await waitFor(seconds: 4) { c.phase != .finishing }
        XCTAssertEqual(c.phase, .failure(.local))
        c.cancel()
    }

    /// ⌥V while the text is being transcribed or the order waits for its «Annulla» is never swallowed: a new utterance starts.
    func testPressWhileFinishingOrSendingStartsANewUtterance() async throws {
        for phase in [VoiceInputController.Phase.finishing, .sending] {
            let c = VoiceInputController.still(phase, files: VoiceFiles(home: home))
            c.makeCapture = { _ in RecordedVoice([]) }
            c.press()
            try await waitFor { c.phase == .listening }
            c.cancel()
        }
    }

    /// An error folds by itself after 8 s (the microphone's too: same line; not tried here, its watcher would open the real microphone).
    func testErrorFoldsByItself() async throws {
        let c = VoiceInputController(files: VoiceFiles(home: home))
        c.show(failure: .network)
        XCTAssertEqual(c.phase, .failure(.network))
        try await waitFor(seconds: 9) { c.phase == .idle }
    }

    /// Scribe's «no voice» while Roberto still speaks is not the end of the utterance.
    func testScribeQuietDoesNotEndTheUtterance() {
        let c = VoiceInputController.still(.listening, files: VoiceFiles(home: home))
        c.scribeEvent(.quiet, run: c.run)
        XCTAssertEqual(c.phase, .listening)
    }

    // MARK: - Helpers

    private func controller(_ buffers: [AVAudioPCMBuffer]) -> (VoiceInputController, RecordedVoice) {
        let voice = RecordedVoice(buffers)
        let c = VoiceInputController(files: VoiceFiles(home: home))
        c.makeCapture = { _ in voice }
        return (c, voice)
    }

    /// Press, the recorded voice plays in real time, press again `stopBeforeEnd` s before the voice ends; the text that would leave.
    private func dictate(_ text: String, stopBeforeEnd: TimeInterval) async throws -> String {
        let models = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/FluidAudio/Models/parakeet-tdt-0.6b-v3")
        try XCTSkipUnless(FileManager.default.fileExists(atPath: models.path), "Parakeet v3 not on this Mac")
        let buffers = try Self.recorded(text)
        let (c, voice) = controller(buffers)
        c.press()
        try await waitFor { c.phase == .listening }
        let end = Self.speechEnd(buffers) - stopBeforeEnd
        try await waitFor(seconds: 60) { voice.playedSeconds >= end }
        c.press()  // the second press, inside the last word
        try await waitFor(seconds: 90) { c.phase == .sending }
        let said = c.sure
        c.cancel()  // nothing leaves the test
        return said.lowercased().folding(options: .diacriticInsensitive, locale: nil)
    }

    private func waitFor(seconds: TimeInterval = 5, _ condition: () -> Bool) async throws {
        let deadline = Date().addingTimeInterval(seconds)
        while !condition() {
            guard Date() < deadline else { return XCTFail("timed out") }
            try await Task.sleep(nanoseconds: 20_000_000)
        }
    }

    /// `say` in Italian, 16 kHz mono float, cut in 100 ms buffers like the microphone's.
    static func recorded(_ text: String) throws -> [AVAudioPCMBuffer] {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("clotch-say-\(UUID().uuidString).wav")
        defer { try? FileManager.default.removeItem(at: url) }
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/say")
        p.arguments = ["-v", "Alice", "-o", url.path, "--data-format=LEF32@16000", text]
        try p.run()
        p.waitUntilExit()
        let file = try AVAudioFile(forReading: url)
        var out: [AVAudioPCMBuffer] = []
        while file.framePosition < file.length {
            let b = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: 1600)!
            try file.read(into: b, frameCount: 1600)
            out.append(b)
        }
        return out
    }

    /// Seconds until the last sample that is not silence.
    static func speechEnd(_ buffers: [AVAudioPCMBuffer]) -> TimeInterval {
        var last = 0, i = 0
        for b in buffers {
            let s = b.floatChannelData![0]
            for j in 0..<Int(b.frameLength) { if abs(s[j]) > 0.01 { last = i + j } }
            i += Int(b.frameLength)
        }
        return Double(last) / 16_000
    }
}

/// The microphone, played from a recording in real time; after the recording, room silence, as a real microphone goes on.
final class RecordedVoice: VoiceCapture, @unchecked Sendable {
    private let buffers: [AVAudioPCMBuffer]
    private let queue = DispatchQueue(label: "recorded-voice")
    private var running = false
    private var played = 0
    private let silence: AVAudioPCMBuffer
    private(set) var started = false

    init(_ buffers: [AVAudioPCMBuffer]) {
        self.buffers = buffers
        silence = AVAudioPCMBuffer(pcmFormat: AVAudioFormat(standardFormatWithSampleRate: 16_000, channels: 1)!, frameCapacity: 1600)!
        silence.frameLength = 1600
        memset(silence.floatChannelData![0], 0, 1600 * MemoryLayout<Float>.size)
        super.init(microphone: "")
    }

    var playedSeconds: TimeInterval { queue.sync { Double(played) * 0.1 } }

    override func authorized() async -> Bool { true }
    override func prepare() {}

    override func start() throws {
        started = true
        queue.sync { running = true }
        queue.async { self.tick() }
    }

    override func stop() { queue.sync { running = false } }

    private func tick() {
        guard running else { return }
        let b = played < buffers.count ? buffers[played] : silence
        played += 1
        let samples = Array(UnsafeBufferPointer(start: b.floatChannelData![0], count: Int(b.frameLength)))
        onAudio?(b, VoiceInput.pcm16(samples))
        queue.asyncAfter(deadline: .now() + 0.1) { self.tick() }
    }
}

/// Prove dal vivo 22/10: un avviso detto a microfono aperto finiva nella trascrizione di Roberto.
@MainActor
final class VoiceMicOpenTests: XCTestCase {
    func testOnlyTheOpenMicrophonePhasesBlockTheAlerts() {
        let open: [VoiceInputController.Phase] = [.ready, .listening, .finishing]
        let closed: [VoiceInputController.Phase] = [.idle, .thinking, .sending, .result("x")]
        for p in open { XCTAssertTrue(VoiceInputController.still(p).micOpen, "\(p)") }
        for p in closed { XCTAssertFalse(VoiceInputController.still(p).micOpen, "\(p)") }
    }
}
