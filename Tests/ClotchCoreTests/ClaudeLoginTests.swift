import XCTest
@testable import ClotchCore

/// #159: every `claude` Clotch starts runs as an account with a login, and a failure says why.
final class ClaudeLoginTests: XCTestCase {
    private var home: String!

    override func setUpWithError() throws {
        home = NSTemporaryDirectory() + "claude-login-\(UUID().uuidString)"
        let fm = FileManager.default
        for dir in [".claude", ".claude-b", ".claude-a", ".claude-extra"] { try fm.createDirectory(atPath: home + "/" + dir, withIntermediateDirectories: true) }
        fm.createFile(atPath: home + "/.claude-file", contents: Data())  // a file, not an account
        try #"{"oauthAccount":{"emailAddress":"b@x.it"}}"#.write(toFile: home + "/.claude-b/.claude.json", atomically: true, encoding: .utf8)
        try #"{"oauthAccount":{"emailAddress":"a@x.it"}}"#.write(toFile: home + "/.claude-a/.claude.json", atomically: true, encoding: .utf8)
    }

    override func tearDownWithError() throws { try? FileManager.default.removeItem(atPath: home) }

    func testFoldersAreMainThenExtrasThenEveryClaudeFolderOnce() {
        let got = ClaudeLogin.folders(home: home, primary: home + "/.claude", extras: [home + "/.claude-extra", home + "/missing"])
        XCTAssertEqual(got, [".claude", ".claude-extra", ".claude-a", ".claude-b"].map { home + "/" + $0 })
    }

    func testAccountWithMostMarginComesFirst() {
        let folders = [".claude", ".claude-a", ".claude-b"].map { home + "/" + $0 }
        XCTAssertEqual(ClaudeLogin.email(folder: home + "/.claude-b"), "b@x.it")
        XCTAssertNil(ClaudeLogin.email(folder: home + "/.claude"))
        let got = ClaudeLogin.ordered(folders, ranked: ["b@x.it", "a@x.it"], email: ClaudeLogin.email(folder:))
        XCTAssertEqual(got, [".claude-b", ".claude-a", ".claude"].map { home + "/" + $0 })
    }

    func testPickSkipsFoldersWithoutLogin() {
        // Roberto's Mac: ~/.claude has no login, the second account has one.
        XCTAssertEqual(ClaudeLogin.pick(["/h/.claude", "/h/.claude-b", "/h/.claude-c"]) { $0 != "/h/.claude" }, "/h/.claude-b")
        XCTAssertNil(ClaudeLogin.pick(["/h/.claude"]) { _ in false })
    }

    func testAuthStatusJSON() {
        XCTAssertTrue(ClaudeLogin.isLoggedIn(statusJSON: Data(#"{"loggedIn": true, "authMethod": "claude.ai"}"#.utf8)))
        XCTAssertFalse(ClaudeLogin.isLoggedIn(statusJSON: Data(#"{"loggedIn": false, "authMethod": "none"}"#.utf8)))
        XCTAssertFalse(ClaudeLogin.isLoggedIn(statusJSON: Data("not json".utf8)))
    }

    func testNotLoggedInIsAClearMessageNotNil() {
        // The exact output the master saw from the call without CLAUDE_CONFIG_DIR.
        let r = ClaudeLogin.outcome(status: 1, timedOut: false, stdout: "Not logged in · Please run /login", stderr: "")
        XCTAssertEqual(r, .failure(.notLoggedIn))
        XCTAssertEqual(ClaudeLogin.Failure.notLoggedIn.message, "Nessun account Claude collegato. Esegui /login in Claude Code.")
    }

    func testOtherOutcomes() {
        XCTAssertEqual(ClaudeLogin.outcome(status: 0, timedOut: false, stdout: " ciao \n", stderr: ""), .success("ciao"))
        XCTAssertEqual(ClaudeLogin.outcome(status: 0, timedOut: false, stdout: "  ", stderr: ""), .failure(.empty))
        XCTAssertEqual(ClaudeLogin.outcome(status: 15, timedOut: true, stdout: "", stderr: ""), .failure(.timeout))
        XCTAssertEqual(ClaudeLogin.outcome(status: 1, timedOut: false, stdout: "", stderr: "API Error: 429 rate limit"), .failure(.limit))
        XCTAssertEqual(ClaudeLogin.outcome(status: 1, timedOut: false, stdout: "", stderr: "boom"), .failure(.failed))
        for f in [ClaudeLogin.Failure.noBinary, .noAccount, .notLoggedIn, .limit, .timeout, .empty, .failed] {
            XCTAssertFalse(f.message.isEmpty)
            XCTAssertFalse(f.message.contains("!"))
        }
    }
}
