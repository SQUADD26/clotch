import XCTest
@testable import CodeIslandCore

/// The click on a goal's title or a taken request: which link it builds, for which app copy, and when it does nothing.
final class SessionTargetTests: GoalTestCase {
    func testLinkIsTheEpitaxyRouteOfTheLocalId() {
        XCTAssertEqual(SessionTarget(localId: "local_abc-1", profile: "").url?.absoluteString, "claude://claude.ai/epitaxy/local_abc-1")
        for bad in ["", "abc", "local_", "local_../settings", "fa0f1317-6ad4-4416-ac46-67bb32fc5e7b"] {
            XCTAssertNil(SessionTarget(localId: bad, profile: "/p").url, "«\(bad)» is no session the app accepts: no action")
        }
    }

    func testAppCopyIsFoundByItsDataFolder() {
        let launcher = """
        #!/bin/bash
        export CLAUDE_CONFIG_DIR="$HOME/.claude-b"
        exec "/Applications/Claude.app/Contents/MacOS/Claude" --user-data-dir="$HOME/Library/Application Support/Claude-b/" "$@"
        """
        let dir = SessionTarget.dataDir(launcher: launcher, home: "/Users/r")
        XCTAssertEqual(dir, "/Users/r/Library/Application Support/Claude-b")
        let file = "/Users/r/Library/Application Support/Claude-b/claude-code-sessions/acct/org/local_x.json"
        XCTAssertEqual(SessionTarget.profile(ofSessionFile: file), dir, "a session file names the copy that owns it")
        XCTAssertNotEqual(SessionTarget.profile(ofSessionFile: file.replacingOccurrences(of: "Claude-b", with: "Claude-c")), dir)
        XCTAssertNil(SessionTarget.dataDir(launcher: "#!/bin/bash\nexec Claude\n", home: "/Users/r"))
        XCTAssertEqual(SessionTarget.profile(ofSessionFile: "/tmp/local_x.json"), "")
    }

    func testGoalTitleOpensItsMasterAndNothingWithoutOne() {
        var master = s("local_m", cli: "m1")
        master.profile = "/Users/r/Library/Application Support/Claude-b"
        let row = GoalBoard.rows(goals: [g("m1")], sessions: [master], live: [], now: now)[0]
        XCTAssertEqual(row.master, SessionTarget(localId: "local_m", profile: master.profile))
        XCTAssertEqual(row.master?.url?.absoluteString, "claude://claude.ai/epitaxy/local_m")
        XCTAssertNil(GoalBoard.rows(goals: [g("m1")], sessions: [], live: [], now: now)[0].master, "no session: no click")
    }

    /// The register names the taker by cli id; the link needs its local id and the app copy of its file,
    /// found even when the taker belongs to no goal (outside every family).
    func testRequestOpensTheSessionThatTookIt() throws {
        let fm = FileManager.default
        let home = fm.temporaryDirectory.appendingPathComponent("target-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: home) }
        let sessions = home.appendingPathComponent("Library/Application Support/Claude-b/claude-code-sessions/acct/org")
        try fm.createDirectory(at: sessions, withIntermediateDirectories: true)
        let paths = GoalSources.defaultPaths(home: home)  // after the folder exists: it lists the Claude* app folders
        try fm.createDirectory(at: paths.requests, withIntermediateDirectories: true)
        try sessionJSON("local_t", cli: "taker").write(to: sessions.appendingPathComponent("local_t.json"))
        func request(_ id: String, _ state: String, by: String, localId: String? = nil) throws {
            let local = localId.map { #", "local_id": "\#($0)""# } ?? ""
            try Data(#"{"id": "\#(id)", "t": 1792580000, "testo": "x", "stato": "\#(state)", "presa_da": "\#(by)"\#(local)}"#.utf8)
                .write(to: paths.requests.appendingPathComponent("\(id).json"))
        }
        try request("Q-a", "presa", by: "taker")
        try request("Q-b", "presa", by: "nobody")
        try request("Q-c", "nuova", by: "taker")
        try request("Q-d", "presa", by: "nobody", localId: "local_t")  // the register's local_id wins, no cli lookup needed
        try request("Q-e", "presa", by: "taker", localId: "local_other")  // its own id, even if the cli points elsewhere
        try request("Q-f", "presa", by: "taker", localId: "")  // empty: the fallback
        let byId = Dictionary(uniqueKeysWithValues: GoalSources.load(paths).requests.map { ($0.id, $0.target) })
        let found = try XCTUnwrap(byId["Q-a"] ?? nil)
        XCTAssertEqual(found.localId, "local_t")
        XCTAssertTrue(found.profile.hasSuffix("/Library/Application Support/Claude-b"), found.profile)  // /var vs /private/var
        XCTAssertNil(byId["Q-b"] ?? nil, "taker not found: no click")
        XCTAssertNil(byId["Q-c"] ?? nil, "not taken yet: no click")
        XCTAssertEqual((byId["Q-d"] ?? nil)?.localId, "local_t")
        XCTAssertEqual((byId["Q-d"] ?? nil)?.profile, found.profile, "profile found by the local id")
        XCTAssertEqual(byId["Q-e"] ?? nil, SessionTarget(localId: "local_other", profile: ""), "id unknown here: default app, not the cli session folder")
        XCTAssertEqual((byId["Q-f"] ?? nil)?.localId, "local_t")
    }
}
