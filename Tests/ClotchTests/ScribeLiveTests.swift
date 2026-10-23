import AVFoundation
import XCTest
@testable import Clotch
import ClotchCore

/// #314, on request only (SCRIBE_LIVE=1): the real `VoiceInputController` on ElevenLabs Scribe v2 with the real key, a voice recorded
/// with `say -o` (nothing is played) and a temporary home. Press, the voice, press: the transcript comes back, no error pill.
@MainActor
final class ScribeLiveTests: XCTestCase {
    func testScribeTranscribesRecordedVoice() async throws {
        guard ProcessInfo.processInfo.environment["SCRIBE_LIVE"] == "1" else { throw XCTSkip("SCRIBE_LIVE not set") }
        let real = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".config/elevenlabs/api-key")
        guard FileManager.default.fileExists(atPath: real.path) else { throw XCTSkip("no ElevenLabs key on this Mac") }
        let home = FileManager.default.temporaryDirectory.appendingPathComponent("clotch-scribe-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: home) }
        let voce = home.appendingPathComponent(".config/voce")
        try FileManager.default.createDirectory(at: voce, withIntermediateDirectories: true)
        let config: [String: Any] = ["ingresso_motore": "scribe", "ingresso_modo": "premi", "ingresso_lingua": "it", "ingresso_a_voce": false]
        try JSONSerialization.data(withJSONObject: config).write(to: voce.appendingPathComponent("config.json"))
        let key = home.appendingPathComponent(".config/elevenlabs/api-key")
        try FileManager.default.createDirectory(at: key.deletingLastPathComponent(), withIntermediateDirectories: true)
        try FileManager.default.createSymbolicLink(at: key, withDestinationURL: real)

        let buffers = try VoiceInputCaptureTests.recorded("Buongiorno, questa è una prova di dettatura.")
        let voice = RecordedVoice(buffers)
        let c = VoiceInputController(files: VoiceFiles(home: home))
        c.makeCapture = { _ in voice }
        var asked: String?
        c.ask = { q, _ in asked = q; return .success("ok") }

        c.press()
        try await until(10) { c.phase == .listening }
        let end = VoiceInputCaptureTests.speechEnd(buffers) + 0.3
        try await until(30) { voice.playedSeconds >= end || { if case .failure = c.phase { return true } else { return false } }() }
        c.press()
        try await until(20) { asked != nil || c.sure.count > 0 || { if case .failure = c.phase { return true } else { return false } }() }
        if case .failure(let why) = c.phase { return XCTFail("Scribe failed: \(why)") }
        let said = asked ?? c.sure
        print("SCRIBE LIVE transcript: \(said)")
        XCTAssertTrue(said.lowercased().contains("prova"), said)
        c.cancel()
    }

    private func until(_ seconds: TimeInterval, _ condition: () -> Bool) async throws {
        let deadline = Date().addingTimeInterval(seconds)
        while !condition() {
            guard Date() < deadline else { return XCTFail("timed out") }
            try await Task.sleep(nanoseconds: 20_000_000)
        }
    }
}
