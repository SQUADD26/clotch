import XCTest
@testable import CodeIslandCore

/// Fixtures are real-shaped JSON strings: the register as obiettivo_registro.py writes it,
/// desktop-app local_*.json, and handoff live/<cli>.json as live_state.py writes it.
final class GoalBoardTests: XCTestCase {
    private let now = GoalSources.date("2026-10-21T14:00:00+0000")!

    // MARK: fixtures

    private func minutesAgo(_ m: Double) -> Date { now.addingTimeInterval(-m * 60) }
    private func ms(_ m: Double) -> Int { Int(minutesAgo(m).timeIntervalSince1970 * 1000) }
    private func local(_ m: Double) -> String {  // live_state.now(): local time, no zone
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return f.string(from: minutesAgo(m))
    }

    private func goalJSON(_ cli: String, stato: String = "aperto", prova: String = "", titolo: String = "", prove: String? = nil,
                          t: String = "2026-10-21T13:13:52+0000") -> Data {
        // Keys and indent as obiettivo_registro.scrivi (json.dump(ensure_ascii=False, indent=1)).
        let extra = prove.map { ",\n \"prove\": \($0)" } ?? ""
        return Data("""
        {
         "cli": "\(cli)",
         "storia": [
          {"obiettivo": "vecchio", "da": "roberto", "stato": "passato", "prova": "", "t": "2026-10-20T09:00:00+0200"}
         ],
         "obiettivo": "Fare  il\\n   dato   vivo",
         "da": "master",
         "stato": "\(stato)",
         "prova": "\(prova)",
         "t": "\(t)",
         "titolo": "\(titolo)",
         "visto": "ab12cd34ef"\(extra)
        }
        """.utf8)
    }

    private func sessionJSON(_ local: String, cli: String, parent: String? = nil, running: Bool = false, archived: Bool = false,
                             ago: Double = 5, title: String = "") -> Data {
        Data("""
        {"sessionId": "\(local)", "cliSessionId": "\(cli)", "title": "\(title)", "isRunning": \(running), "isArchived": \(archived),
         "lastActivityAt": \(ms(ago)), "cwd": "/x"\(parent.map { ", \"spawnedFrom\": \($0)" } ?? "")}
        """.utf8)
    }

    private func g(_ cli: String, stato: String = "aperto", prova: String = "", titolo: String = "", prove: String? = nil) -> GoalRecord {
        GoalSources.parseGoal(goalJSON(cli, stato: stato, prova: prova, titolo: titolo, prove: prove))!
    }

    private func s(_ local: String, cli: String, parent: String? = nil, running: Bool = false, archived: Bool = false,
                   ago: Double = 5, title: String = "") -> DesktopSession {
        GoalSources.parseSession(sessionJSON(local, cli: cli, parent: parent, running: running, archived: archived, ago: ago, title: title),
                                 fileName: "\(local).json")!
    }

    private func liveJSON(_ agents: String, transcript: String = "", updated: Double = 1) -> Data {
        Data("""
        {"aggiornato": "\(local(updated))", "transcript": "\(transcript)", "cwd": "/x", "agenti": \(agents)}
        """.utf8)
    }

    private func rows(_ goals: [GoalRecord], _ sessions: [DesktopSession] = [], _ live: [LiveState] = []) -> [GoalRow] {
        GoalBoard.rows(goals: goals, sessions: sessions, live: live, now: now)
    }

    // MARK: parsing

    func testParseGoalAsTheRegisterWritesIt() {
        let r = g("cli-1", titolo: "★ Barra goal")
        XCTAssertEqual(r.cli, "cli-1")
        XCTAssertEqual(r.state, "aperto")
        XCTAssertNil(r.proofs, "prove is absent until someone writes it")
        XCTAssertEqual(r.at, GoalSources.date("2026-10-21T13:13:52+0000"))
    }

    func testDateFormats() {
        let utc = 1_792_588_432.0  // 2026-10-21T13:13:52Z
        XCTAssertEqual(GoalSources.date("2026-10-21T13:13:52+0300")!.timeIntervalSince1970, utc - 3 * 3600)
        XCTAssertEqual(GoalSources.date("2026-10-21T13:13:52+03:00")!.timeIntervalSince1970, utc - 3 * 3600)
        XCTAssertEqual(GoalSources.date("2026-10-21T13:13:52Z")!.timeIntervalSince1970, utc)
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        let c = cal.dateComponents([.year, .month, .day, .hour, .minute, .second], from: GoalSources.date("2026-10-21T13:13:52")!)
        XCTAssertEqual([c.year!, c.month!, c.day!, c.hour!, c.minute!, c.second!], [2026, 10, 21, 13, 13, 52], "no zone = local time")
        XCTAssertEqual(GoalSources.date(1_792_588_432_000 as Int)!.timeIntervalSince1970, utc)
        XCTAssertNil(GoalSources.date("yesterday"))
        XCTAssertNil(GoalSources.date(nil))
    }

    func testMalformedJSONIsSkipped() {
        let junk = Data("{not json".utf8)
        XCTAssertNil(GoalSources.parseGoal(junk))
        XCTAssertNil(GoalSources.parseGoal(Data("[1,2]".utf8)))
        XCTAssertNil(GoalSources.parseSession(junk, fileName: "local_x.json"))
        XCTAssertNil(GoalSources.parseLive(junk, cliId: "x"))
        XCTAssertNil(GoalSources.parseSession(Data(#"{"sessionId":"local_a"}"#.utf8), fileName: "local_a.json"), "no cliSessionId")
        XCTAssertNil(GoalSources.parseSession(Data(#"{"cliSessionId":"c","scheduledTaskId":"t"}"#.utf8), fileName: "local_a.json"), "scheduled task")
    }

    func testSessionIdFallsBackToFileName() {
        let d = GoalSources.parseSession(Data(#"{"cliSessionId":"c1"}"#.utf8), fileName: "local_abc.json")
        XCTAssertEqual(d?.localId, "local_abc")
        XCTAssertNil(d?.lastActivity)
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

    // MARK: visibility

    func testPassatoIsHidden() {
        XCTAssertTrue(rows([g("m", stato: "passato")], [s("local_m", cli: "m")]).isEmpty)
    }

    func testRaggiuntoOnlyWhileMasterIsLive() {
        let done = g("m", stato: "raggiunto", prova: "tutto ok")
        XCTAssertTrue(rows([done]).isEmpty, "master missing")
        XCTAssertTrue(rows([done], [s("local_m", cli: "m", archived: true)]).isEmpty, "master archived")
        let r = rows([done], [s("local_m", cli: "m")])
        XCTAssertEqual(r.count, 1)
        XCTAssertEqual(r[0].status, .reached)
        XCTAssertEqual(r[0].progress, 1.0)
    }

    func testBloccatoCarriesTheProof() {
        let r = rows([g("m", stato: "bloccato", prova: "serve la chiave")], [s("local_m", cli: "m")])
        XCTAssertEqual(r[0].status, .blocked(reason: "serve la chiave"))
    }

    // MARK: status

    func testMovingThenStillAfterThirtyMinutes() {
        XCTAssertEqual(rows([g("m")], [s("local_m", cli: "m", ago: 29)])[0].status, .moving)
        let still = rows([g("m")], [s("local_m", cli: "m", ago: 31)])[0]
        XCTAssertEqual(still.status, .still(since: minutesAgo(31)))
        XCTAssertEqual(still.lastActivity, minutesAgo(31))
    }

    func testRunningChildKeepsItMoving() {
        let sessions = [s("local_m", cli: "m", ago: 120), s("local_c", cli: "c", parent: #"{"sessionId": "local_m"}"#, running: true, ago: 120)]
        let r = rows([g("m")], sessions)[0]
        XCTAssertEqual(r.status, .moving)
        XCTAssertEqual(r.pulses.filter(\.running).map(\.id), ["local_c"])
    }

    func testFamilyIsRecursiveWithDictAndStringSpawnedFrom() {
        let sessions = [
            s("local_m", cli: "m", ago: 90, title: "★ Master"),
            s("local_c", cli: "c", parent: #"{"sessionId": "local_m", "x": 1}"#, ago: 90),       // dict
            s("local_gc", cli: "gc", parent: #""local_c""#, running: true, ago: 2),               // string, grandchild
            s("local_old", cli: "o", parent: #""local_m""#, archived: true, ago: 1),               // archived: not a pulse
            s("local_other", cli: "z", ago: 1),
        ]
        let r = rows([g("m")], sessions)[0]
        XCTAssertEqual(Set(r.pulses.map(\.id)), ["local_m", "local_c", "local_gc"])
        XCTAssertEqual(r.pulses.first { $0.id == "local_m" }?.kind, .master)
        XCTAssertEqual(r.pulses.first { $0.id == "local_gc" }?.kind, .child)
        XCTAssertEqual(r.status, .moving)
        XCTAssertEqual(r.title, "Master", "falls back to the master session title without the star")
    }

    func testCycleInSpawnedFromTerminates() {
        let sessions = [s("local_a", cli: "m", parent: #""local_b""#), s("local_b", cli: "b", parent: #"{"sessionId": "local_a"}"#),
                        s("local_self", cli: "x", parent: #""local_self""#)]
        XCTAssertEqual(Set(rows([g("m")], sessions)[0].pulses.map(\.id)), ["local_a", "local_b"])
    }

    // MARK: proofs

    func testProofsAbsentMeansNoProgress() {
        let r = rows([g("m")], [s("local_m", cli: "m")])[0]
        XCTAssertNil(r.progress)
        XCTAssertEqual(r.proofsTotal, 0)
        XCTAssertEqual(r.goal, "Fare il dato vivo", "whitespace collapsed")
    }

    func testProofsTwoOfThreeAndTolerance() {
        let prove = #"[{"testo": "a", "fatta": true, "t": "2026-10-21T13:00:00+0300"}, {"testo": "b", "fatta": true}, {"testo": "c"}, {"fatta": true}]"#
        let goal = g("m", prove: prove)
        XCTAssertEqual(goal.proofs?.map(\.done), [true, true, false], "entry without testo dropped, fatta missing = false")
        XCTAssertNil(goal.proofs?[1].at)
        let r = rows([goal], [s("local_m", cli: "m")])[0]
        XCTAssertEqual([r.proofsDone, r.proofsTotal], [2, 3])
        XCTAssertEqual(r.progress ?? 0, 2.0 / 3.0, accuracy: 1e-9)
    }

    // MARK: subagents

    func testAliveSubagentCountedStaleOneNot() {
        let json = """
        {"fresh": {"stato": "vivo", "partito": "\(local(50))", "ultimo_tool": {"nome": "Bash", "quando": "\(local(3))"}},
         "stale": {"stato": "vivo", "partito": "\(local(45))", "ultimo_tool": {"quando": "\(local(31))"}},
         "done": {"stato": "finito", "partito": "\(local(2))"}}
        """
        let live = GoalSources.parseLive(liveJSON(json, updated: 90), cliId: "m")!
        XCTAssertEqual(live.agents.map(\.id), ["done", "fresh", "stale"])
        let sessions = [s("local_m", cli: "m", ago: 90)]
        let r = rows([g("m")], sessions, [live])[0]
        XCTAssertEqual(r.pulses.filter { $0.kind == .subagent }.map(\.id), ["m:fresh"])
        XCTAssertEqual(r.status, .moving)

        let onlyStale = GoalSources.parseLive(liveJSON(#"{"stale": {"stato": "vivo", "partito": "\#(local(45))"}}"#, updated: 90), cliId: "m")!
        let r2 = rows([g("m")], sessions, [onlyStale])[0]
        XCTAssertTrue(r2.pulses.allSatisfy { $0.kind != .subagent })
        guard case .still = r2.status else { return XCTFail("expected still, got \(r2.status)") }
    }

    // MARK: ordering

    func testSortBlockedStillMovingReached() {
        let goals = [g("reached", stato: "raggiunto"), g("moving"), g("still"), g("blocked", stato: "bloccato", prova: "x"), g("moving2")]
        let sessions = [s("l1", cli: "reached"), s("l2", cli: "moving", ago: 1), s("l3", cli: "still", ago: 99),
                        s("l4", cli: "blocked"), s("l5", cli: "moving2", ago: 10)]
        XCTAssertEqual(rows(goals, sessions).map(\.id), ["blocked", "still", "moving", "moving2", "reached"])
    }
}
