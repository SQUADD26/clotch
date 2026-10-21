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

    func testUsageGetsAccountNamesWithoutReadingSecrets() throws {
        let fm = FileManager.default
        let home = fm.temporaryDirectory.appendingPathComponent("names-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: home) }
        let paths = GoalSources.defaultPaths(home: home)
        for d in [paths.usage, home.appendingPathComponent(".config/claude-accounts"), home.appendingPathComponent(".claude-r"),
                  home.appendingPathComponent(".claude-n")] {
            try fm.createDirectory(at: d, withIntermediateDirectories: true)
        }
        try data("""
        {"accounts": {"r-bondici": {"config": "~/.claude-r", "email": "old@x", "securestorage": "~/nope"},
                      "plain": {"config": "~/.claude"}, "declared": {"config": "~/.claude-missing", "email": "d@x"},
                      "nulled": {"config": "~/.claude-n"}}}
        """).write(to: home.appendingPathComponent(".config/claude-accounts/accounts.json"))
        // project history before the login, with braces and a decoy key inside strings
        try data("""
        {"projects": {"/a": {"history": [{"display": "{ oauthAccount }"}]}}, "oauthAccount": {"accountUuid": "u-1", "emailAddress": "r@x",
         "organizationName": "S"}, "other": {"accountUuid": "decoy"}}
        """).write(to: home.appendingPathComponent(".claude-r/.claude.json"))
        try data(#"{"oauthAccount": {"accountUuid": "u-2"}}"#).write(to: home.appendingPathComponent(".claude.json"))
        try data(#"{"oauthAccount": null, "x": {"accountUuid": "u-wrong"}}"#).write(to: home.appendingPathComponent(".claude-n/.claude.json"))
        let usage = #"{"at": 1, "scaduto": false}"#
        for id in ["u-1", "u-2", "d@x", "1234567890abcdef", "u-wrong"] {
            try data(usage).write(to: paths.usage.appendingPathComponent("uso-acct-\(id).json"))
        }
        let r = GoalSources.load(paths).usage
        XCTAssertEqual(Dictionary(uniqueKeysWithValues: r.map { ($0.id, $0.label) }),
                       ["u-1": "r-bondici", "u-2": "plain", "d@x": "declared", "1234567890abcdef": "12345678", "u-wrong": "u-wrong"])
        XCTAssertEqual(r.map(\.label), ["12345678", "declared", "plain", "r-bondici", "u-wrong"], "sorted by what the view shows")
    }

    // MARK: requests

    func testParseRequestAsRichiestePyWritesIt() {
        // richieste.aggiungi + cambia(PRESA): epoch seconds, extra fields the notch ignores.
        let r = GoalSources.parseRequest(data("""
        {
         "id": "Q-1a2b3c4d", "t": 1792588432.25, "data": "2026-10-21T13:13:52+00:00", "sessione": "cli-m",
         "titolo_sessione": "★ Notch: goal", "testo": "Fai  la\\nbarra", "originale": "fai la barra del notch, grazie",
         "cartella": "/Users/r/goal-notch", "stato": "presa", "t_presa": 1792588500, "presa_da": "Notch: goal",
         "t_fatta": null, "prova": "", "non_nostra": false, "aggiornato": 1792588500, "futuro": {"x": 1}
        }
        """))!
        XCTAssertEqual(r.id, "Q-1a2b3c4d")
        XCTAssertEqual(r.at, Date(timeIntervalSince1970: 1_792_588_432.25))
        XCTAssertEqual(r.sessionTitle, "Notch: goal")
        XCTAssertEqual(r.text, "Fai la barra")
        XCTAssertEqual(r.original, "fai la barra del notch, grazie")
        XCTAssertEqual(r.folder, "/Users/r/goal-notch")
        XCTAssertTrue(r.taken)
        XCTAssertEqual(r.takenBy, "Notch: goal")
        XCTAssertEqual(r.takenAt, Date(timeIntervalSince1970: 1_792_588_500))
        XCTAssertNil(r.doneAt)

        let done = GoalSources.parseRequest(data("""
        {"id": "Q-2", "t": "2026-10-21T13:00:00+0300", "testo": "x", "stato": "fatta", "t_fatta": "2026-10-21T13:05:00Z",
         "prova": "non nostra", "non_nostra": true}
        """))!
        XCTAssertTrue(done.taken && done.notOurs)
        XCTAssertEqual(done.proof, "non nostra")
        XCTAssertNotNil(done.at)
        XCTAssertNotNil(done.doneAt)
        let bare = GoalSources.parseRequest(data(#"{"id": "Q-3", "testo": "x"}"#))!
        XCTAssertFalse(bare.taken, "no stato = nuova")
        XCTAssertEqual(bare.original, "x")
        XCTAssertNil(GoalSources.parseRequest(data(#"{"testo": "no id"}"#)))
    }

    func testNewlyTakenFiresOncePerRequest() {
        func req(_ id: String, _ stato: String) -> UserRequest {
            GoalSources.parseRequest(data(#"{"id": "\#(id)", "testo": "x", "stato": "\#(stato)"}"#))!
        }
        let first = [req("a", "nuova"), req("old", "presa")]
        XCTAssertEqual(UserRequest.newlyTaken(before: nil, after: first, shown: []), [], "launch is the baseline")
        let second = [req("a", "presa"), req("old", "presa"), req("b", "nuova"), req("fast", "presa"), req("c", "fatta")]
        XCTAssertEqual(UserRequest.newlyTaken(before: first, after: second, shown: []), ["a", "fast", "c"],
                       "nuova -> presa, born and taken between loads, straight to fatta")
        XCTAssertEqual(UserRequest.newlyTaken(before: first, after: second, shown: ["a"]), ["fast", "c"], "a shown id never repeats")
        XCTAssertEqual(UserRequest.newlyTaken(before: second, after: second, shown: []), [], "no change, no event")
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
        try data(#"{"id": "old", "t": 1792580000, "testo": "a"}"#).write(to: paths.requests.appendingPathComponent("old.json"))
        try data(#"{"id": "new", "t": "2026-10-21T12:00:00+0000", "testo": "b"}"#).write(to: paths.requests.appendingPathComponent("new.json"))
        try data("{broken").write(to: paths.requests.appendingPathComponent("bad.json"))
        try data(#"{"id": "tmp", "testo": "c"}"#).write(to: paths.requests.appendingPathComponent("tmp.json.tmp"))
        try data("errore").write(to: paths.requests.appendingPathComponent("errori.log"))

        let r = GoalSources.load(paths)
        XCTAssertEqual(r.usage.map(\.id), ["a", "b"])
        XCTAssertEqual(r.requests.map(\.id), ["new", "old"], "newest first")
    }

    func testAccountNameFromDesktopAppFolder() throws {
        let fm = FileManager.default
        let home = fm.temporaryDirectory.appendingPathComponent("feeds-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: home) }
        let id = "f5c31b0f-80df-4c45-a343-71768151f6f4"
        let support = home.appendingPathComponent("Library/Application Support")
        try fm.createDirectory(at: support.appendingPathComponent("Claude-r-bondici/claude-code-sessions/\(id)/org"),
                               withIntermediateDirectories: true)
        try fm.createDirectory(at: support.appendingPathComponent("Claude/claude-code-sessions/1599c9b4-0000-4000-8000-000000000000"),
                               withIntermediateDirectories: true)
        let paths = GoalSources.defaultPaths(home: home)
        try fm.createDirectory(at: paths.usage, withIntermediateDirectories: true)
        let usage = #"{"at": 1, "five_hour": {"usato": 1, "reset": null}, "scaduto": false}"#
        try data(usage).write(to: paths.usage.appendingPathComponent("uso-acct-\(id).json"))
        try data(usage).write(to: paths.usage.appendingPathComponent("uso-acct-1599c9b4-0000-4000-8000-000000000000.json"))

        let labels = GoalSources.load(paths).usage.map(\.label)
        XCTAssertEqual(labels, ["1599c9b4", "r-bondici"], "plain Claude folder: no name, short id")
    }
}
