import XCTest
@testable import Clotch

/// #159: the env of every `claude` Clotch starts names the chosen account, whatever the app inherited.
final class ClaudeRunTests: XCTestCase {
    func testEnvironmentNamesTheAccountFolder() {
        let env = ClaudeRun.environment("/h/.claude-b", base: ["PATH": "/usr/bin", "CLAUDE_CONFIG_DIR": "/h/.claude"])
        XCTAssertEqual(env["CLAUDE_CONFIG_DIR"], "/h/.claude-b")
        XCTAssertEqual(env["CLOTCH_VOCE_INTERNA"], "1")
        XCTAssertEqual(env["PATH"], "/usr/bin")
    }
}
