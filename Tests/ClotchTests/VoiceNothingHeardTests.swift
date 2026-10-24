import XCTest
@testable import Clotch
import ClotchCore

/// #269 and #271, on the controller with a fake launcher and a fake voice (as #270): no microphone, no audio, no `claude -p`.
@MainActor
final class VoiceNothingHeardTests: XCTestCase {
    private var home: URL!

    override func setUpWithError() throws {
        home = FileManager.default.temporaryDirectory.appendingPathComponent("clotch-269-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: home, withIntermediateDirectories: true)
    }

    override func tearDown() async throws { try? FileManager.default.removeItem(at: home) }

    private func controller() -> VoiceInputController {
        let c = VoiceInputController(files: VoiceFiles(home: home))
        c.deliver = { _ in .answered("Risposta finta") }
        return c
    }

    /// Black team 22/10: «16.4 s of audio, 0 words» and the bar folded mute. Now it says it.
    func testSixteenSecondsAndNoWordsSaysNothingHeard() async {
        let c = VoiceInputController.still(.finishing, files: VoiceFiles(home: home))
        c.listened = 16.4
        c.peak = 0
        await c.route("", run: c.run)
        XCTAssertEqual(c.phase, .failure(.nothingHeard))
        XCTAssertEqual(c.light, .red)
    }

    /// #147 stays: a tap with no words folds quietly.
    func testAShortTapWithNoWordsStaysQuiet() async {
        let c = VoiceInputController.still(.finishing, files: VoiceFiles(home: home))
        c.listened = 0.6
        await c.route("", run: c.run)
        XCTAssertEqual(c.phase, .idle)
    }

    /// #271: after the answer the pill keeps «Penso…» until the voice makes its first sound.
    func testThePillKeepsThinkingUntilTheFirstSound() async throws {
        let c = controller()
        var release: CheckedContinuation<Void, Never>?
        c.speak = { _ in await withCheckedContinuation { release = $0 } }  // a voice that has not started yet
        await c.route("Quali sessioni stanno lavorando adesso?", run: c.run)
        try await Task.sleep(nanoseconds: 200_000_000)
        XCTAssertEqual(c.phase, .thinking, "the helper is done, the voice is not: no fold to idle")
        VoiceSpeaker.shared.onPlay?()  // the first sound
        XCTAssertEqual(c.phase, .idle)
        release?.resume()
    }

    /// A voice that ends without ever sounding (no key, no credits) does not leave «Penso…» on the bar.
    func testASpeechThatNeverSoundsStillFolds() async throws {
        let c = controller()
        c.speak = { _ in }
        await c.route("Quali sessioni stanno lavorando adesso?", run: c.run)
        try await Task.sleep(nanoseconds: 200_000_000)
        XCTAssertEqual(c.phase, .idle)
    }
}
