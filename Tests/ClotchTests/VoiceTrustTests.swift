import AVFoundation
import XCTest
@testable import Clotch
import ClotchCore

/// #1120: the voiceprint on the Mac. Recorded voices (macOS `say`) stand in for Roberto (Alice) and for other people; the real
/// WeSpeaker model measures them. The distances are printed: they are the numbers behind `VoiceTrust.yesBelow` / `noAbove`.
@MainActor
final class VoiceTrustTests: XCTestCase {
    private var home: URL!
    private var store: VoiceTrust.Store!

    override func setUp() async throws {
        home = FileManager.default.temporaryDirectory.appendingPathComponent("clotch-fidata-\(UUID().uuidString)")
        let voce = home.appendingPathComponent(".config/voce")
        try FileManager.default.createDirectory(at: voce, withIntermediateDirectories: true)
        let config: [String: Any] = ["ingresso_acceso": true, "ingresso_motore": "locale", "ingresso_modo": "premi", "ingresso_lingua": "it"]
        try JSONSerialization.data(withJSONObject: config).write(to: voce.appendingPathComponent("config.json"))
        store = VoiceTrust.Store(url: home.appendingPathComponent("impronta.json"))
    }

    override func tearDown() async throws { try? FileManager.default.removeItem(at: home) }

    static func samples(_ text: String, voice: String) throws -> [Float] {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("clotch-say-\(UUID().uuidString).wav")
        defer { try? FileManager.default.removeItem(at: url) }
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/say")
        p.arguments = ["-v", voice, "-o", url.path, "--data-format=LEF32@16000", text]
        try p.run(); p.waitUntilExit()
        let file = try AVAudioFile(forReading: url)
        let b = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length))!
        try file.read(into: b)
        return Array(UnsafeBufferPointer(start: b.floatChannelData![0], count: Int(b.frameLength)))
    }

    private func enrolled() async throws -> VoiceEnroll {
        let e = VoiceEnroll(store: store)
        for phrase in VoiceEnroll.phrases { await e.add(try Self.samples(phrase, voice: "Alice")) }
        return e
    }

    // MARK: - Voices

    func testHisVoiceIsAcceptedAnotherIsNot() async throws {
        let e = try await enrolled()
        XCTAssertEqual(e.state, .done)
        XCTAssertTrue(store.exists)
        let order = "Manda un messaggio a Marco e dimmi quando hai finito di controllare la richiesta."
        var report = ""
        let mine = await SpeakerVerifier.shared.check(try Self.samples(order, voice: "Alice"), store: store)
        report += "Alice (la voce registrata): \(mine.verdict.rawValue) distanza \(mine.distance)\n"
        XCTAssertEqual(mine.verdict, .yes, report)
        for other in ["Eddy (Italiano (Italia))", "Daniel", "Kathy", "Fred", "Jacques"] {
            let r = await SpeakerVerifier.shared.check(try Self.samples(order, voice: other), store: store)
            report += "\(other): \(r.verdict.rawValue) distanza \(r.distance)\n"
            XCTAssertNotEqual(r.verdict, .yes, report)
        }
        print("VOICETRUST\n" + report)
    }

    func testTooShortIsNeverYes() async throws {
        _ = try await enrolled()
        let r = await SpeakerVerifier.shared.check(try Self.samples("Sì vai", voice: "Alice"), store: store)
        print("VOICETRUST corta: \(r.verdict.rawValue) distanza \(r.distance)")
        XCTAssertNotEqual(r.verdict, .yes)
    }

    func testTheFileHoldsNumbersOnlyAndIsPrivate() async throws {
        _ = try await enrolled()
        let attrs = try FileManager.default.attributesOfItem(atPath: store.url.path)
        XCTAssertEqual((attrs[.posixPermissions] as? Int), 0o600)
        XCTAssertFalse(store.url.path.contains("/Repos/"))
    }

    // MARK: - The order's road

    private func controller(_ buffers: [AVAudioPCMBuffer], verdict: VoiceTrust.Verdict, unlocked: Bool = true, printed: Bool = true) throws -> VoiceInputController {
        let c = VoiceInputController(files: VoiceFiles(home: home))
        c.makeCapture = { _ in RecordedVoice(buffers) }
        c.verify = { _ in (verdict, verdict == .yes ? 0.12 : 0.7) }
        c.unlocked = { unlocked }
        c.trustStore = store
        c.soundPlayer = { _ in }
        if printed { try store.save([[1, 0], [1, 0.1], [1, 0.2]]) }
        return c
    }

    private func waitFor(seconds: TimeInterval = 8, _ condition: () -> Bool) async throws {
        let deadline = Date().addingTimeInterval(seconds)
        while !condition() {
            guard Date() < deadline else { return XCTFail("timed out") }
            try await Task.sleep(nanoseconds: 20_000_000)
        }
    }

    /// Press, speak, press: the phase after the transcript.
    private func speakAndStop(_ c: VoiceInputController, _ text: String) async throws {
        let buffers = try VoiceInputCaptureTests.recorded(text)
        c.makeCapture = { _ in RecordedVoice(buffers) }
        c.press()
        try await waitFor { c.phase == .listening }
        try await Task.sleep(nanoseconds: UInt64((VoiceInputCaptureTests.speechEnd(buffers) + 0.3) * 1e9))
        c.press()
    }

    func testAnotherVoiceDoesNotAct() async throws {
        try XCTSkipUnless(FileManager.default.fileExists(atPath: FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/FluidAudio/Models/parakeet-tdt-0.6b-v3").path))
        let c = try controller([], verdict: .no)
        try await speakAndStop(c, "Cancella la cartella dei clienti dal server")
        try await waitFor(seconds: 60) { c.phase == .failure(.notYou) }
        c.cancel()
    }

    func testNoPrintNoOrders() async throws {
        try XCTSkipUnless(FileManager.default.fileExists(atPath: FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/FluidAudio/Models/parakeet-tdt-0.6b-v3").path))
        let c = try controller([], verdict: .yes, printed: false)
        try await speakAndStop(c, "Controlla la richiesta di Marco")
        try await waitFor(seconds: 60) { c.phase == .failure(.noVoiceprint) }
        c.cancel()
    }

    func testLockedMacDoesNotListen() async throws {
        let c = try controller([], verdict: .yes, unlocked: false)
        c.press()
        XCTAssertEqual(c.phase, .failure(.locked))
    }

    func testSoundComesAtTheStop() async throws {
        let c = try controller([], verdict: .yes)
        var played: [String] = []
        c.soundPlayer = { played.append($0) }
        let buffers = try VoiceInputCaptureTests.recorded("Controlla la richiesta di Marco")
        c.makeCapture = { _ in RecordedVoice(buffers) }
        c.press()
        try await waitFor { c.phase == .listening }
        XCTAssertTrue(played.isEmpty)
        c.press()
        XCTAssertEqual(played, ["Tink"])
        print("VOICETRUST ho sentito: \(String(format: "%.2f", c.heardAfter)) ms dopo la fine")
        XCTAssertLessThan(c.heardAfter, 100)
        c.cancel()
    }
}
