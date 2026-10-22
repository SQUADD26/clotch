import XCTest
@testable import ClotchCore

/// #263: a command of the engine that fails must not vanish. The launcher gives back stderr and exit, and a sentence for the view.
final class EngineCommandTests: XCTestCase {
    private func sh(_ script: String) -> Result<Data, EngineCommand.Failure> {
        EngineCommand.run("/bin/sh", ["-c", script], log: { _ in })
    }

    func testFailingCommandKeepsStderrExitAndSaysItInOneSentence() {
        guard case .failure(let failure) = sh("echo 'richieste: store bloccato' >&2; exit 3") else { return XCTFail("exit 3 must be a failure") }
        XCTAssertEqual(failure, .exit(status: 3, stderr: "richieste: store bloccato"))
        XCTAssertFalse(failure.message.isEmpty)
        XCTAssertFalse(failure.message.contains("3"), "no codes in the sentence")
        XCTAssertFalse(failure.message.contains("store bloccato"), "stderr goes to the log, not to the view")
    }

    func testFailureIsLoggedWithStderrAndExit() {
        var lines: [String] = []
        _ = EngineCommand.run("/bin/sh", ["-c", "echo boom >&2; exit 7"], log: { lines.append($0) })
        XCTAssertEqual(lines.count, 1)
        XCTAssertTrue(lines[0].contains("exit 7") && lines[0].contains("boom"), lines.joined())
    }

    func testSuccessGivesStdout() throws {
        XCTAssertEqual(String(decoding: try sh("printf ok").get(), as: UTF8.self), "ok")
    }

    func testCommandThatDoesNotStart() {
        guard case .failure(let failure) = EngineCommand.run("/non/esiste", [], log: { _ in }) else { return XCTFail("must fail") }
        XCTAssertEqual(failure, .notStarted)
    }

    func testRobertoIsNotASession() throws {
        setenv("CLAUDE_CODE_SESSION_ID", "cli-1", 1)
        defer { unsetenv("CLAUDE_CODE_SESSION_ID") }
        XCTAssertEqual(String(decoding: try sh("printf '%s' \"${CLAUDE_CODE_SESSION_ID-none}\"").get(), as: UTF8.self), "none")
    }
}
