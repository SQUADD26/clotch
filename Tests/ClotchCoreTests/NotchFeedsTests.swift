import XCTest
@testable import ClotchCore

/// Session identity across a cli change, and requests, from real-shaped JSON.
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
        XCTAssertEqual(r.title, "⭕ Overseer ⭕")
        XCTAssertEqual(r.pulses.map(\.id), ["local_new"], "the live session wins over the archived one")
        XCTAssertEqual(r.status, .moving, "activity time drives the status when isRunning is unknown")
        XCTAssertEqual(GoalBoard.reach(goals: [goal("old")], sessions: [archived, live]).live, ["old", "new"])
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

    // MARK: requests

    func testParseRequestAsRichiestePyWritesIt() {
        // richieste.aggiungi + cambia(PRESA): epoch seconds, extra fields the notch ignores.
        let r = GoalSources.parseRequest(data("""
        {
         "id": "Q-1a2b3c4d", "t": 1792588432.25, "data": "2026-10-21T13:13:52+00:00", "sessione": "cli-m",
         "titolo_sessione": "★ Notch: goal", "testo": "Fai  la\\nbarra", "originale": "fai la barra del notch, grazie",
         "cartella": "/Users/r/clotch", "stato": "presa", "t_presa": 1792588500, "presa_da": "Notch: goal",
         "t_fatta": null, "prova": "", "non_nostra": false, "aggiornato": 1792588500, "futuro": {"x": 1}
        }
        """))!
        XCTAssertEqual(r.id, "Q-1a2b3c4d")
        XCTAssertEqual(r.at, Date(timeIntervalSince1970: 1_792_588_432.25))
        XCTAssertEqual(r.sessionTitle, "★ Notch: goal")
        XCTAssertEqual(r.text, "Fai la barra")
        XCTAssertEqual(r.original, "fai la barra del notch, grazie")
        XCTAssertEqual(r.folder, "/Users/r/clotch")
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

    func testTitleIsRealTextNeverATag() {
        func title(_ testo: String, _ originale: String = "") -> String {
            let json = try! JSONSerialization.data(withJSONObject: ["id": "Q-1", "testo": testo, "originale": originale])
            return GoalSources.parseRequest(json)!.text
        }
        XCTAssertEqual(title("Correggere   notch"), "Correggere notch", "the short title, spaces collapsed")
        XCTAssertEqual(title("<system-reminder>Attribution…</system-reminder>\nAprire tunnel Cloudflare"), "Aprire tunnel Cloudflare")
        XCTAssertEqual(title("<system-reminder>", "Aprire tunnel\nper colleghi"), "Aprire tunnel", "the original gives its first line")
        XCTAssertEqual(title("<system-reminder>", "<system-reminder>x</system-reminder>\n\nAprire tunnel"), "Aprire tunnel",
                       "an unclosed tag in the short title: the first real line of the original")
        XCTAssertEqual(title(#"<pasted_content id="a">log</pasted_content> Guarda questo"#), "Guarda questo")
        XCTAssertEqual(title("<system-reminder>", "<system-reminder>solo tag"), "una richiesta", "nothing real left")
    }

    func testLookStrikesOnlyWhenDone() {
        func look(_ stato: String) -> UserRequest.Look {
            GoalSources.parseRequest(data(#"{"id": "Q-1", "testo": "x", "stato": "\#(stato)"}"#))!.look
        }
        XCTAssertEqual(look("nuova"), .waiting)
        XCTAssertEqual(look("presa"), .working)
        XCTAssertFalse(look("presa").struck, "taken = at work, not struck (#39)")
        XCTAssertEqual(look("presa").label, "In lavorazione")
        XCTAssertEqual(look("presa").ink, .wait, "taken = yellow, never green (#67)")
        XCTAssertEqual(look("fatta").ink, .go)
        XCTAssertEqual(look("nuova").ink, .quiet)
        XCTAssertEqual(look("fatta"), .done)
        XCTAssertTrue(look("fatta").struck)
        XCTAssertEqual(look("fatta").label, "Fatta")
    }

    // MARK: folders

    func testLoadReadsRequestsAndSkipsTempFiles() throws {
        let fm = FileManager.default
        let home = fm.temporaryDirectory.appendingPathComponent("feeds-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: home) }
        let paths = GoalSources.defaultPaths(home: home)
        let empty = GoalSources.load(paths)
        XCTAssertTrue(empty.requests.isEmpty, "missing folder = honest empty state")
        XCTAssertFalse(fm.fileExists(atPath: paths.requests.path), "nothing is created")

        try fm.createDirectory(at: paths.requests, withIntermediateDirectories: true)
        try data(#"{"id": "old", "t": 1792580000, "testo": "a"}"#).write(to: paths.requests.appendingPathComponent("old.json"))
        try data(#"{"id": "new", "t": "2026-10-21T12:00:00+0000", "testo": "b"}"#).write(to: paths.requests.appendingPathComponent("new.json"))
        try data("{broken").write(to: paths.requests.appendingPathComponent("bad.json"))
        try data(#"{"id": "tmp", "testo": "c"}"#).write(to: paths.requests.appendingPathComponent("tmp.json.tmp"))
        try data("errore").write(to: paths.requests.appendingPathComponent("errori.log"))

        let r = GoalSources.load(paths)
        XCTAssertEqual(r.requests.map(\.id), ["new", "old"], "newest first")
    }

    /// Fake register files, test only: a request goes nuova -> presa on disk; the next load strikes it
    /// (taken) and fires «presa in carico» exactly once.
    func testRequestTakenOnDiskStrikesAndFiresOnce() throws {
        let fm = FileManager.default
        let home = fm.temporaryDirectory.appendingPathComponent("feeds-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: home) }
        let paths = GoalSources.defaultPaths(home: home)
        try fm.createDirectory(at: paths.requests, withIntermediateDirectories: true)
        let file = paths.requests.appendingPathComponent("Q-1.json")
        try data(#"{"id": "Q-1", "t": 1792580000, "testo": "Barra le richieste", "stato": "nuova"}"#).write(to: file)
        let before = GoalSources.load(paths).requests
        XCTAssertEqual(before.map(\.taken), [false])

        try data(#"{"id": "Q-1", "t": 1792580000, "testo": "Barra le richieste", "stato": "presa", "t_presa": 1792580100}"#).write(to: file)
        let after = GoalSources.load(paths).requests
        XCTAssertEqual(after.map(\.taken), [true], "struck through")
        XCTAssertEqual(UserRequest.newlyTaken(before: before, after: after, shown: []), ["Q-1"])
        XCTAssertEqual(UserRequest.newlyTaken(before: after, after: after, shown: []), [], "once")
    }

    /// The Requests tab lists only the ones nobody has taken; a done one is taken too.
    func testWaitingDropsTakenAndDone() {
        let all = ["nuova", "presa", "fatta", "nuova"].enumerated().map { i, state in
            GoalSources.parseRequest(data(#"{"id": "Q-\#(i)", "testo": "x", "stato": "\#(state)"}"#))!
        }
        XCTAssertEqual(UserRequest.waiting(all).map(\.id), ["Q-0", "Q-3"])
        XCTAssertEqual(UserRequest.waiting([]), [])
    }

    /// #61: a question in chat or a note is never «presa in carico»: no row, no count, no notice. No `tipo` = a task.
    func testOnlyTasksAreRequests() {
        func parse(_ tipo: String) -> UserRequest? {
            GoalSources.parseRequest(data(#"{"id": "Q-1", "testo": "x", "stato": "presa"\#(tipo)}"#))
        }
        XCTAssertNil(parse(#", "tipo": "domanda""#))
        XCTAssertNil(parse(#", "tipo": "nota""#))
        XCTAssertEqual(parse(#", "tipo": "compito""#)?.look, .working)
        XCTAssertEqual(parse("")?.look, .working, "an old file without tipo is a task")
    }

    func testQuestionTakenOnDiskNeverAnnounced() throws {
        let fm = FileManager.default
        let home = fm.temporaryDirectory.appendingPathComponent("feeds-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: home) }
        let paths = GoalSources.defaultPaths(home: home)
        try fm.createDirectory(at: paths.requests, withIntermediateDirectories: true)
        for (id, tipo) in [("Q-d", "domanda"), ("Q-n", "nota"), ("Q-c", "compito")] {
            try data(#"{"id": "\#(id)", "t": 1792580000, "testo": "x", "stato": "nuova", "tipo": "\#(tipo)"}"#)
                .write(to: paths.requests.appendingPathComponent("\(id).json"))
        }
        let before = GoalSources.load(paths).requests
        XCTAssertEqual(before.map(\.id), ["Q-c"])
        for (id, tipo) in [("Q-d", "domanda"), ("Q-n", "nota"), ("Q-c", "compito")] {
            try data(#"{"id": "\#(id)", "t": 1792580000, "testo": "x", "stato": "presa", "tipo": "\#(tipo)"}"#)
                .write(to: paths.requests.appendingPathComponent("\(id).json"))
        }
        let after = GoalSources.load(paths).requests
        XCTAssertEqual(UserRequest.newlyTaken(before: before, after: after, shown: []), ["Q-c"], "only the task is announced")
        XCTAssertEqual(UserRequest.waiting(after), [])
    }
}
