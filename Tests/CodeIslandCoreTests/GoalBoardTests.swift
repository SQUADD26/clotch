import XCTest
@testable import CodeIslandCore

final class GoalBoardTests: GoalTestCase {

    // MARK: parsing

    func testParseGoalAsTheRegisterWritesIt() {
        let r = g("cli-1", titolo: "★ Barra goal")
        XCTAssertEqual(r.cli, "cli-1")
        XCTAssertEqual(r.state, "aperto")
        XCTAssertNil(r.proofs, "prove is absent until someone writes it")
        XCTAssertEqual(r.at, GoalSources.date("2026-10-21T13:13:52+0000"))
    }

    func testTitleKeepsIcons() {  // #79: the real title, icon included
        let t = { (titolo: String) in self.rows([self.g("m", titolo: titolo)], [])[0].title }
        XCTAssertEqual(t("★ Setup: pipeline di sviluppo"), "★ Setup: pipeline di sviluppo")
        XCTAssertEqual(t("◰\u{FE0E} Clotch: correzioni"), "◰\u{FE0E} Clotch: correzioni", "text variation selector kept")
        XCTAssertEqual(t("🎨 Figma:  palette"), "🎨 Figma: palette", "only spaces collapsed")
        XCTAssertEqual(t("👨‍💻 dentalspace 🇮🇹"), "👨‍💻 dentalspace 🇮🇹")
        XCTAssertEqual(rows([g("m")], [s("local_m", cli: "m", title: "⭕ Overseer ⭕")])[0].title, "⭕ Overseer ⭕", "session title too")
    }

    func testTitleIsNeverEmpty() {
        let t = { (titolo: String, session: String) in self.rows([self.g("m", titolo: titolo)], [self.s("local_m", cli: "m", title: session)])[0].title }
        XCTAssertEqual(t("★ ⭕", "⭕ Overseer"), "⭕ Overseer", "signs-only register title: the session title")
        XCTAssertEqual(t("", "★ · —"), "Fare il dato vivo", "signs-only session title: the goal's first words")
        XCTAssertEqual(rows([g("m")])[0].title, "Fare il dato vivo", "no session at all")
        XCTAssertEqual(GoalBoard.firstWords("uno due tre quattro cinque sei sette"), "uno due tre quattro cinque sei…")
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

    /// Only the board's keys are parsed; the MCP config (98 % of a real file) is skipped, brackets and
    /// escaped quotes inside its strings included.
    func testSessionParseSkipsBigValues() {
        let big = #""remoteMcpServersConfig": {"a": ["x\\\"}]", {"b": "{[\\"}], "n": [1, 2.5e3, true, null]}, "#
        let text = #"{ "title" : "T\u00e9 \"q\"", "# + big
            + #""cliSessionId": "c1", "spawnedFrom": {"sessionId": "local_p"}, "priorRemoteCliSessionIds": ["o1"],"#
            + #" "isRunning": true, "isArchived": false, "lastActivityAt": 1760000000000, "enabledMcpTools": {"z": [[]]}}"#
        let viaJSON = (try? JSONSerialization.jsonObject(with: Data(text.utf8))) as? [String: Any]
        XCTAssertNotNil(viaJSON, "the fixture is valid JSON")
        let d = GoalSources.parseSession(Data(text.utf8), fileName: "local_x.json")
        XCTAssertEqual(d, DesktopSession(localId: "local_x", cliId: "c1", parentLocalId: "local_p", priorCliIds: ["o1"],
                                         title: "Té \"q\"", isRunning: true, isArchived: false,
                                         lastActivity: Date(timeIntervalSince1970: 1_760_000_000)))
        XCTAssertNil(GoalSources.parseSession(Data(text.utf8.dropLast(3)), fileName: "local_x.json"), "a file caught mid-write")
        XCTAssertEqual(GoalSources.topLevel(Data(#"{"a":1,"b":[{"c":"]"}],"d":"e"}"#.utf8), keys: ["d"])?["d"] as? String, "e")
    }

    func testSessionIdFallsBackToFileName() {
        let d = GoalSources.parseSession(Data(#"{"cliSessionId":"c1"}"#.utf8), fileName: "local_abc.json")
        XCTAssertEqual(d?.localId, "local_abc")
        XCTAssertNil(d?.lastActivity)
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
        XCTAssertEqual(r.title, "★ Master", "falls back to the master session title, star included")
    }

    /// The loader ships only the sessions a goal reaches: rows over them must equal rows over all.
    func testRowsOverReachedSessionsEqualRowsOverAll() {
        let sessions = [
            s("local_u", cli: "u", ago: 1, title: "estranea"),
            s("local_x", cli: "x", archived: true, ago: 3).withPrior(["old"]),
            s("local_m", cli: "m", ago: 90, title: "★ Master").withPrior(["old"]),
            s("local_a", cli: "a", parent: #""local_m""#, archived: true, ago: 1),       // archived link
            s("local_gc", cli: "gc", parent: #""local_a""#, running: true, ago: 2),     // reached through it
            s("local_n", cli: "n", parent: #""local_u""#, ago: 4),
        ]
        let goals = [g("old"), g("gc", stato: "bloccato", prova: "x"), g("none"), g("u", stato: "passato")]
        let live = [LiveState(cliId: "gc", updated: minutesAgo(1), agents: [LiveAgent(id: "s", alive: true, lastActivity: minutesAgo(2))])]
        let reach = GoalBoard.reach(goals: goals, sessions: sessions)
        XCTAssertEqual(reach.sessions, ["local_m", "local_a", "local_gc"])
        XCTAssertEqual(reach.live, ["old", "gc", "m", "none"], "an archived child's live file is never read")
        let subset = sessions.filter { reach.sessions.contains($0.localId) }
        XCTAssertEqual(rows(goals, subset, live), rows(goals, sessions, live))
        XCTAssertEqual(rows(goals, subset, live).first { $0.id == "old" }?.pulses.map(\.id).sorted(), ["gc:s", "local_gc", "local_m"])
    }

    func testNextChangeIsWhenTimeAloneMovesARow() {
        let live = [LiveState(cliId: "m", updated: minutesAgo(40), agents: [LiveAgent(id: "s", alive: true, lastActivity: minutesAgo(25))])]
        let at = GoalBoard.nextChange(goals: [g("m")], sessions: [s("local_m", cli: "m", ago: 10)], live: live, now: now)
        XCTAssertEqual(at, minutesAgo(25).addingTimeInterval(GoalBoard.stillAfter), "the subagent dies first, at 30 min of silence")
        XCTAssertNil(GoalBoard.nextChange(goals: [], sessions: [s("local_m", cli: "m", ago: 31)], live: [], now: now))
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

    private func prove(_ done: Int, of total: Int) -> String {
        "[" + (0..<total).map { #"{"testo": "p\#($0)", "fatta": \#($0 < done)}"# }.joined(separator: ", ") + "]"
    }

    func testOnlyKnownStatesShow() {
        let states = ["aperto", "bloccato", "raggiunto", "proposto", "nessuno", "passato", "nuovo-stato"]
        let shown = rows(states.map { g($0, stato: $0) }, states.map { s("local_\($0)", cli: $0) })
        XCTAssertEqual(Set(shown.map(\.id)), ["aperto", "bloccato", "raggiunto", "proposto"])
        XCTAssertEqual(shown.filter(\.proposed).map(\.id), ["proposto"])
        XCTAssertEqual(shown.map(\.id).suffix(2), ["proposto", "raggiunto"], "proposed sorts after open goals, before reached")
    }

    /// Today's real register: Overseer always active, no proofs; «Sessioni» proposed 0/5 and live;
    /// «Notch» 3/6 with live sessions; «Lead» 0/4.
    func testChasedRule() {
        let goals = [g("overseer"), g("sessioni", stato: "proposto", prove: prove(0, of: 5)), g("notch", prove: prove(3, of: 6)),
                     g("lead", prove: prove(0, of: 4)), g("done", prove: prove(2, of: 2))]
        let sessions = [s("l1", cli: "overseer", running: true, ago: 0), s("l2", cli: "sessioni", running: true, ago: 0),
                        s("l3", cli: "notch", running: true, ago: 2), s("l4", cli: "lead", ago: 1), s("l5", cli: "done", ago: 0)]
        let chased = { (ids: [String]) in GoalBoard.chased(self.rows(goals.filter { ids.contains($0.cli) }, sessions))?.id }
        XCTAssertEqual(chased(["overseer", "sessioni", "notch", "lead", "done"]), "notch", "(a) 0 < done < total wins")
        XCTAssertEqual(chased(["overseer", "sessioni", "lead", "done"]), "done", "(b) else any declared proofs, latest activity")
        XCTAssertEqual(chased(["overseer", "sessioni"]), "overseer", "(c) else any open goal; proposed never")
        XCTAssertNil(chased(["sessioni"]), "only a proposed goal: nothing is chased")
        XCTAssertNil(GoalBoard.chased([]))
    }

    func testSortBlockedStillMovingReached() {
        let goals = [g("reached", stato: "raggiunto"), g("moving"), g("still"), g("blocked", stato: "bloccato", prova: "x"), g("moving2")]
        let sessions = [s("l1", cli: "reached"), s("l2", cli: "moving", ago: 1), s("l3", cli: "still", ago: 99),
                        s("l4", cli: "blocked"), s("l5", cli: "moving2", ago: 10)]
        XCTAssertEqual(rows(goals, sessions).map(\.id), ["blocked", "still", "moving", "moving2", "reached"])
    }
}
