import XCTest
@testable import Clotch
import ClotchCore

/// #270: a test never reaches the real voice helper. The helper's prompt comes from the `VoiceFiles(home:)` the test hands in, the
/// `claude -p` launcher is a seam the test fills with a recorder, and the real launcher refuses to start under xctest.
@MainActor
final class VoiceHelperFakeTests: XCTestCase {
    private var home: URL!
    private let fakePrompt = "PROMPT FINTO DEL TEST (#270)"

    override func setUpWithError() throws {
        home = FileManager.default.temporaryDirectory.appendingPathComponent("clotch-270-\(UUID().uuidString)")
        let hooks = home.appendingPathComponent(".claude/hooks")
        try FileManager.default.createDirectory(at: hooks, withIntermediateDirectories: true)
        try fakePrompt.write(to: hooks.appendingPathComponent("helper_voce_prompt.md"), atomically: true, encoding: .utf8)
    }

    override func tearDown() async throws { try? FileManager.default.removeItem(at: home) }

    /// The prompt of whoever runs the tests: the one no test may see.
    private var realPrompt: String? { try? String(contentsOf: VoiceFiles().helperPromptURL, encoding: .utf8) }

    private func controller() -> (VoiceInputController, Calls) {
        let c = VoiceInputController(files: VoiceFiles(home: home))
        let calls = Calls()
        c.ask = { q, h in calls.list.append((q, h)); return .success("Risposta finta") }
        c.speak = { _ in }
        return (c, calls)
    }

    private final class Calls { var list: [(question: String, helper: String?)] = [] }

    func testQuestionGoesToTheFakeLauncherWithThePromptOfTheGivenHome() async {
        let (c, calls) = controller()
        await c.route("Quali sessioni stanno lavorando adesso?", run: c.run)
        XCTAssertEqual(calls.list.count, 1)
        XCTAssertEqual(calls.list.first?.helper, fakePrompt)
        if let real = realPrompt { XCTAssertNotEqual(calls.list.first?.helper, real, "a test saw the real helper prompt") }
    }

    func testOrderGoesToTheFakeLauncherNotToTheRealHelper() async {
        let (c, calls) = controller()
        await c.route("Chiudi le sessioni vecchie di stasera", run: c.run)  // waits cancelSeconds, then asks the helper
        XCTAssertEqual(calls.list.map(\.question), ["Chiudi le sessioni vecchie di stasera"])
        XCTAssertEqual(calls.list.first?.helper, fakePrompt)
    }

    func testAHomeWithoutPromptHasNoHelper() throws {
        let empty = FileManager.default.temporaryDirectory.appendingPathComponent("clotch-270-vuota-\(UUID().uuidString)")
        XCTAssertNil(VoiceAsk.helperPrompt(files: VoiceFiles(home: empty)))
    }

    func testTheRealLauncherRefusesUnderTests() async {
        // `--version` and not `-p`: if the refusal were gone this would still launch nothing that acts.
        let result = await ClaudeRun.run(["--version"], input: "", timeout: 2)
        XCTAssertEqual(result, .failure(.failed))
    }
}
