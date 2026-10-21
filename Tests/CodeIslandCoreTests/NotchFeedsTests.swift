import XCTest
@testable import CodeIslandCore

/// Session identity across a cli change, account usage and requests, from real-shaped JSON.
final class NotchFeedsTests: XCTestCase {
    private let now = GoalSources.date("2026-10-21T14:00:00+0000")!
    private func data(_ s: String) -> Data { Data(s.utf8) }

    private func goal(_ cli: String, extra: String = "") -> GoalRecord {
        GoalSources.parseGoal(data(#"{"cli": "\#(cli)", "obiettivo": "x y z w", "stato": "aperto", "titolo": "⭕ Overseer ⭕"\#(extra)}"#))!
    }

    // MARK: a goal follows its session after /clear or resume

    func testGoalFindsSessionByPriorCliIdAndCountsIt() {
        // As the desktop app writes it after a /clear: new cliSessionId, isRunning absent.
        let live = GoalSources.parseSession(data("""
        {"sessionId": "local_new", "cliSessionId": "new", "priorRemoteCliSessionIds": ["old", 7], "title": "⭕ Overseer ⭕",
         "isArchived": false, "lastActivityAt": \(Int(now.timeIntervalSince1970 * 1000) - 60_000), "bridgeSessionIds": []}
        """), fileName: "local_new.json")!
        let archived = GoalSources.parseSession(data("""
        {"sessionId": "local_arch", "cliSessionId": "z", "priorRemoteCliSessionIds": ["old"], "isArchived": true}
        """), fileName: "local_arch.json")!
        XCTAssertEqual(live.priorCliIds, ["old"])
        XCTAssertFalse(live.isRunning, "absent isRunning = not known running")

        let r = GoalBoard.rows(goals: [goal("old")], sessions: [archived, live], live: [], now: now)[0]
        XCTAssertEqual(r.title, "Overseer")
        XCTAssertEqual(r.pulses.map(\.id), ["local_new"], "the live session wins over the archived one")
        XCTAssertEqual(r.status, .moving, "activity time drives the status when isRunning is unknown")
        XCTAssertEqual(GoalBoard.liveIds(goals: [goal("old")], sessions: [archived, live]), ["old", "new"])
    }

    func testCurrentCliIdWinsOverAnotherSessionsPriorId() {
        let a = GoalSources.parseSession(data(#"{"sessionId": "local_a", "cliSessionId": "x"}"#), fileName: "local_a.json")!
        let b = GoalSources.parseSession(data(#"{"sessionId": "local_b", "cliSessionId": "y", "priorRemoteCliSessionIds": ["x"]}"#),
                                         fileName: "local_b.json")!
        XCTAssertEqual(GoalBoard.rows(goals: [goal("x")], sessions: [b, a], live: [], now: now)[0].pulses.map(\.id), ["local_a"])
    }

    func testGoalFollowsSuccessorField() {
        let s = GoalSources.parseSession(data(#"{"sessionId": "local_s", "cliSessionId": "next"}"#), fileName: "local_s.json")!
        XCTAssertEqual(GoalBoard.rows(goals: [goal("gone", extra: #", "a": "next""#)], sessions: [s], live: [], now: now)[0]
            .pulses.map(\.id), ["local_s"])
    }

    // MARK: usage

    func testParseUsageAsClaudeAccountsUsoWritesIt() {
        let u = GoalSources.parseUsage(data("""
        {"at": 1792588432.5, "five_hour": {"usato": 42.0, "reset": 1792600000.0}, "seven_day": {"usato": 7, "reset": null},
         "extra": null, "src": "k", "exp": 1, "fails": 0, "riprova": null, "motivo": null, "scaduto": false}
        """), fileName: "uso-acct-abc-123.json")!
        XCTAssertEqual(u.id, "abc-123")
        XCTAssertEqual(u.at, Date(timeIntervalSince1970: 1_792_588_432.5))
        XCTAssertEqual(u.fiveHour, UsageWindow(used: 42, reset: Date(timeIntervalSince1970: 1_792_600_000)))
        XCTAssertEqual(u.sevenDay, UsageWindow(used: 7, reset: nil))
        XCTAssertFalse(u.expired)

        let bad = GoalSources.parseUsage(data(#"{"five_hour": null, "motivo": "login scaduto", "scaduto": true}"#), fileName: "uso-acct-x.json")!
        XCTAssertNil(bad.fiveHour)
        XCTAssertTrue(bad.expired)
        XCTAssertEqual(bad.reason, "login scaduto")
    }

    // MARK: requests

    func testParseRequest() {
        let r = GoalSources.parseRequest(data("""
        {"id": "r1", "t": "2026-10-21T13:00:00+0300", "sessione": "local_m", "titolo_sessione": "★ Notch: goal",
         "testo": "Fai  la\\nbarra", "stato": "presa", "t_presa": "2026-10-21T13:05:00+0300", "presa_da": "local_c", "t_fatta": null}
        """))!
        XCTAssertEqual(r.sessionTitle, "Notch: goal")
        XCTAssertEqual(r.text, "Fai la barra")
        XCTAssertTrue(r.taken)
        XCTAssertEqual(r.takenBy, "local_c")
        XCTAssertNotNil(r.takenAt)
        XCTAssertNil(r.doneAt)
        XCTAssertFalse(GoalSources.parseRequest(data(#"{"id": "r2", "testo": "x"}"#))!.taken, "no stato = nuova")
        XCTAssertNil(GoalSources.parseRequest(data(#"{"testo": "no id"}"#)))
    }

    // MARK: folders

    func testLoadReadsUsageAndRequestsAndSkipsTempFiles() throws {
        let fm = FileManager.default
        let home = fm.temporaryDirectory.appendingPathComponent("feeds-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: home) }
        let paths = GoalSources.defaultPaths(home: home)
        let empty = GoalSources.load(paths)
        XCTAssertTrue(empty.usage.isEmpty && empty.requests.isEmpty, "missing folders = honest empty state")
        XCTAssertFalse(fm.fileExists(atPath: paths.requests.path), "nothing is created")

        for d in [paths.usage, paths.requests] { try fm.createDirectory(at: d, withIntermediateDirectories: true) }
        let usage = #"{"at": 1, "five_hour": {"usato": 1, "reset": null}, "scaduto": false}"#
        try data(usage).write(to: paths.usage.appendingPathComponent("uso-acct-b.json"))
        try data(usage).write(to: paths.usage.appendingPathComponent("uso-acct-a.json"))
        try data(usage).write(to: paths.usage.appendingPathComponent("uso-acct-a.json.12345"))
        try data(usage).write(to: paths.usage.appendingPathComponent("limits-acct-a.json"))
        try data(#"{"id": "old", "t": "2026-10-21T10:00:00+0000", "testo": "a"}"#).write(to: paths.requests.appendingPathComponent("old.json"))
        try data(#"{"id": "new", "t": "2026-10-21T12:00:00+0000", "testo": "b"}"#).write(to: paths.requests.appendingPathComponent("new.json"))
        try data("{broken").write(to: paths.requests.appendingPathComponent("bad.json"))

        let r = GoalSources.load(paths)
        XCTAssertEqual(r.usage.map(\.id), ["a", "b"])
        XCTAssertEqual(r.requests.map(\.id), ["new", "old"], "newest first")
    }
}
