import XCTest
@testable import ClotchCore

/// The loader against real folders: work per reload follows the changed files and the goal families.
final class GoalLoaderTests: GoalTestCase {
    /// The live folder on a real Mac holds one file per session ever run (~3500 + locks): load must read
    /// only the open goals' families and never walk subagent trees of finished agents.
    func testLoadStaysFastOnAHugeLiveFolder() throws {
        let fm = FileManager.default
        let home = fm.temporaryDirectory.appendingPathComponent("goals-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: home) }
        let support = home.appendingPathComponent("Library/Application Support/Claude/claude-code-sessions/acct")
        try fm.createDirectory(at: support, withIntermediateDirectories: true)
        let paths = GoalSources.defaultPaths(home: home)
        try fm.createDirectory(at: paths.goals, withIntermediateDirectories: true)
        try fm.createDirectory(at: paths.live, withIntermediateDirectories: true)
        // One shared transcript tree with many subagent files, as an old busy session leaves behind.
        let transcript = home.appendingPathComponent("p/old")
        let nested = transcript.appendingPathComponent("subagents/workflows/run")
        try fm.createDirectory(at: nested, withIntermediateDirectories: true)
        for i in 0..<300 { try Data("x".utf8).write(to: nested.appendingPathComponent("agent-x\(i).jsonl")) }
        let deadAgents = "{" + (0..<20).map { #""x\#($0)": {"stato": "finito", "partito": "\#(local(600))"}"# }.joined(separator: ",") + "}"
        let dead = liveJSON(deadAgents, transcript: transcript.path + ".jsonl", updated: 600)
        for i in 0..<3000 {
            try dead.write(to: paths.live.appendingPathComponent("old\(i).json"))
            try Data().write(to: paths.live.appendingPathComponent("old\(i).lock"))
        }
        try goalJSON("m1").write(to: paths.goals.appendingPathComponent("m1.json"))
        try sessionJSON("local_m", cli: "m1").write(to: support.appendingPathComponent("local_m.json"))
        try sessionJSON("local_c", cli: "c1", parent: #""local_m""#).write(to: support.appendingPathComponent("local_c.json"))
        let alive = #"{"x7": {"stato": "vivo", "partito": "\#(local(50))"}}"#  // found only in the nested tree
        try liveJSON(alive, transcript: transcript.path + ".jsonl", updated: 50).write(to: paths.live.appendingPathComponent("c1.json"))

        let start = Date()
        let r = GoalSources.load(paths)
        let elapsed = Date().timeIntervalSince(start)
        XCTAssertEqual(Set(r.live.map(\.cliId)), ["c1"], "only the goal family's live files are read")
        XCTAssertLessThan(Date().timeIntervalSince(r.live.first?.agents.first?.lastActivity ?? .distantPast), 120,
                          "a nested subagent transcript still counts as activity")
        XCTAssertLessThan(elapsed, 0.5, "load took \(elapsed) s")
    }

    /// The desktop apps rewrite a few session files every minute among thousands: a reload touches only
    /// the paths file events named, whatever their spelling (/var vs /private/var on macOS).
    func testReloadParsesOnlyChangedFiles() throws {
        let fm = FileManager.default
        let home = fm.temporaryDirectory.appendingPathComponent("goals-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: home) }
        let support = home.appendingPathComponent("Library/Application Support/Claude/claude-code-sessions/acct")
        try fm.createDirectory(at: support, withIntermediateDirectories: true)
        let paths = GoalSources.defaultPaths(home: home)
        try fm.createDirectory(at: paths.goals, withIntermediateDirectories: true)
        try goalJSON("c1").write(to: paths.goals.appendingPathComponent("c1.json"))
        let old = Date(timeIntervalSinceNow: -3600)
        for i in 0..<2000 {
            let url = support.appendingPathComponent("local_\(i).json")
            try sessionJSON("local_\(i)", cli: "c\(i)").write(to: url)
            try fm.setAttributes([.modificationDate: old], ofItemAtPath: url.path)
        }
        let loader = GoalLoader(paths: paths)
        XCTAssertEqual(loader.load(changed: nil)?.sessions.map(\.localId), ["local_1"], "only the goal's family is shipped")
        XCTAssertEqual(loader.sessions.all.count, 2000)
        XCTAssertEqual(loader.sessions.parses, 2000)

        let nine = support.appendingPathComponent("local_9.json"), ten = support.appendingPathComponent("local_10.json")
        try sessionJSON("local_9", cli: "c9", title: "nove").write(to: nine)
        try fm.removeItem(at: ten)
        let outside = home.appendingPathComponent("elsewhere/local_x.json").path
        let start = Date()
        // FSEvents names resolved paths: on macOS /private/var/… for a /var/… temp dir.
        let r = loader.load(changed: [nine.resolvingSymlinksInPath().path, support.resolvingSymlinksInPath().path + "/local_10.json", outside])
        let elapsed = Date().timeIntervalSince(start)
        XCTAssertEqual(loader.sessions.parses, 2001, "only the named changed file is parsed")
        XCTAssertNil(r, "sessions outside every goal family: no new board")
        XCTAssertEqual(loader.sessions.all.count, 1999, "a named deleted file is dropped")
        XCTAssertEqual(loader.sessions["local_9.json"]?.title, "nove")
        XCTAssertLessThan(elapsed, 0.05, "event reload took \(elapsed) s")

        // Same content rewritten (only the mtime moves): parsed once, no new board.
        try sessionJSON("local_9", cli: "c9", title: "nove").write(to: nine)
        try fm.setAttributes([.modificationDate: Date(timeIntervalSinceNow: 5)], ofItemAtPath: nine.path)
        XCTAssertNil(loader.load(changed: [nine.path]), "nothing the board reads changed")
        XCTAssertEqual(loader.sessions.parses, 2002)
        XCTAssertNil(loader.load(changed: [home.appendingPathComponent("Library/Application Support/Chrome/x").path]),
                     "a foreign path costs nothing")
        XCTAssertEqual(loader.sessions.parses, 2002)

        // Inside the family: activity ships; a new child joins the family.
        let one = support.appendingPathComponent("local_1.json"), kid = support.appendingPathComponent("local_kid.json")
        try sessionJSON("local_1", cli: "c1", title: "uno").write(to: one)
        XCTAssertEqual(loader.load(changed: [one.path])?.sessions.map(\.title), ["uno"])
        try sessionJSON("local_kid", cli: "k", parent: #""local_1""#).write(to: kid)
        XCTAssertEqual(loader.load(changed: [kid.path])?.sessions.map(\.localId), ["local_1", "local_kid"])
    }

    /// A restart parses only the session files changed since the index was saved (367 MB on a real Mac).
    func testIndexSkipsUnchangedFilesAcrossLaunches() throws {
        let fm = FileManager.default
        let home = fm.temporaryDirectory.appendingPathComponent("goals-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: home) }
        let support = home.appendingPathComponent("Library/Application Support/Claude/claude-code-sessions/acct")
        try fm.createDirectory(at: support, withIntermediateDirectories: true)
        let paths = GoalSources.defaultPaths(home: home)
        try fm.createDirectory(at: paths.goals, withIntermediateDirectories: true)
        try goalJSON("c1").write(to: paths.goals.appendingPathComponent("c1.json"))
        for i in 0..<50 { try sessionJSON("local_\(i)", cli: "c\(i)").write(to: support.appendingPathComponent("local_\(i).json")) }
        try Data(#"{"cliSessionId":"t","scheduledTaskId":"x"}"#.utf8).write(to: support.appendingPathComponent("local_task.json"))
        let index = home.appendingPathComponent("Library/Application Support/Clotch/\(GoalLoader.indexName)")

        let first = GoalLoader(paths: paths, index: index)
        let a = first.load(changed: nil)
        XCTAssertEqual(first.sessions.parses, 51)
        XCTAssertTrue(fm.fileExists(atPath: index.path))

        let second = GoalLoader(paths: paths, index: index)
        let b = second.load(changed: nil)
        XCTAssertEqual(second.sessions.parses, 0, "nothing changed since the index: nothing parsed, not even the task")
        XCTAssertEqual(b?.sessions, a?.sessions)
        XCTAssertEqual(second.sessions.all.count, 50)

        try sessionJSON("local_1", cli: "c1", title: "nuovo").write(to: support.appendingPathComponent("local_1.json"))
        try fm.setAttributes([.modificationDate: Date(timeIntervalSinceNow: 60)], ofItemAtPath: support.appendingPathComponent("local_1.json").path)
        try fm.removeItem(at: support.appendingPathComponent("local_2.json"))
        let third = GoalLoader(paths: paths, index: index)
        XCTAssertEqual(third.load(changed: nil)?.sessions.map(\.title), ["nuovo"])
        XCTAssertEqual(third.sessions.parses, 1)
        XCTAssertEqual(third.sessions.all.count, 49)
    }

    func testLoadReadsFoldersAndSkipsGarbage() throws {
        let fm = FileManager.default
        let home = fm.temporaryDirectory.appendingPathComponent("goals-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: home) }
        let none = GoalSources.defaultPaths(home: home)
        XCTAssertTrue(GoalSources.load(none).goals.isEmpty, "missing dirs = no data, and nothing is created")
        XCTAssertFalse(fm.fileExists(atPath: none.goals.path))

        let support = home.appendingPathComponent("Library/Application Support/Claude/claude-code-sessions/acct/org")
        let transcript = home.appendingPathComponent("p/t1")
        try fm.createDirectory(at: support, withIntermediateDirectories: true)
        let paths = GoalSources.defaultPaths(home: home)  // roots are discovered from what exists
        for d in [paths.goals, paths.live, support, transcript.appendingPathComponent("subagents/deep")] {
            try fm.createDirectory(at: d, withIntermediateDirectories: true)
        }
        try goalJSON("m1").write(to: paths.goals.appendingPathComponent("m1.json"))
        try Data("{broken".utf8).write(to: paths.goals.appendingPathComponent("bad.json"))
        try sessionJSON("local_m", cli: "m1").write(to: support.appendingPathComponent("local_m.json"))
        try Data("nope".utf8).write(to: support.appendingPathComponent("local_bad.json"))
        // the subagent is "vivo" since 50 min, but its transcript was written just now
        let agents = #"{"a1": {"stato": "vivo", "partito": "\#(local(50))"}}"#
        try liveJSON(agents, transcript: transcript.path + ".jsonl", updated: 50).write(to: paths.live.appendingPathComponent("m1.json"))
        try Data("x".utf8).write(to: transcript.appendingPathComponent("subagents/deep/agent-a1.jsonl"))

        let r = GoalSources.load(paths)
        XCTAssertEqual(r.goals.map(\.cli), ["m1"])
        XCTAssertEqual(r.sessions.map(\.localId), ["local_m"])
        XCTAssertEqual(r.live.first?.agents.first?.alive, true)
        let fresh = Date().timeIntervalSince(r.live.first?.agents.first?.lastActivity ?? .distantPast)
        XCTAssertLessThan(fresh, 60, "subagent transcript mtime counts as activity")
    }
}
