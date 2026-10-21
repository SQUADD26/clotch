import XCTest
@testable import ClotchCore

/// #57: the voice speaks only for the five kinds of news; «Parla per», no duplicates, one at a time, stale = silent.
final class VoiceAlertsTests: XCTestCase {
    let now = Date(timeIntervalSince1970: 1_792_000_000)
    let main = VoiceTurn.Config([:])  // «Parla per» of serie: only main sessions

    func session(_ local: String, cli: String, parent: String? = nil, running: Bool? = nil, idle: Double = 60) -> DesktopSession {
        let p = parent.map { #", "spawnedFrom": {"sessionId": "\#($0)"}"# } ?? ""
        let r = running.map { #", "isRunning": \#($0)"# } ?? ""
        return GoalSources.parseSession(Data("""
        {"sessionId": "\(local)", "cliSessionId": "\(cli)", "title": "t", "isArchived": false,
         "lastActivityAt": \(Int((now.timeIntervalSince1970 - idle) * 1000))\(p)\(r)}
        """.utf8), fileName: "\(local).json")!
    }
    var sessions: [DesktopSession] { [session("local_m", cli: "m"), session("local_c", cli: "c", parent: "local_m")] }

    func event(_ kind: VoiceEvent.Kind, _ subject: String, session: String = "m", ago: Double = 5, level: String? = nil) -> VoiceEvent {
        VoiceEvent(kind: kind, at: now.addingTimeInterval(-ago), session: session, subject: subject, text: subject, level: level)
    }

    // MARK: engine

    func testEveryKindFromAMainSessionSpeaksAndAChildStaysSilent() {
        for kind in VoiceEvent.Kind.allCases {
            var e = VoiceAlertEngine()
            XCTAssertNil(e.offer(event(kind, "x"), config: main, sessions: sessions, now: now), "\(kind) speaks")
            XCTAssertEqual(e.offer(event(kind, "y", session: "c"), config: main, sessions: sessions, now: now), "fuori da «Parla per»")
            XCTAssertEqual(e.next(now: now)?.subject, "x")
        }
        var e = VoiceAlertEngine()
        XCTAssertNil(e.offer(event(.risk, "account", session: ""), config: VoiceTurn.Config(["parla_per": "una", "sessione": "local_z"]),
                             sessions: sessions, now: now), "no session (an account): «Parla per» lets it through")
        XCTAssertNil(e.offer(event(.question, "q", session: "c"), config: VoiceTurn.Config(["parla_per": "tutte"]), sessions: sessions, now: now))
    }

    func testSameSubjectWithinTenMinutesIsSaidOnce() {
        var e = VoiceAlertEngine()
        XCTAssertNil(e.offer(event(.goalReached, "Timer che scorre"), config: main, sessions: sessions, now: now))
        XCTAssertEqual(e.offer(event(.requestDone, " timer  che scorre. "), config: main, sessions: sessions, now: now.addingTimeInterval(60)), "doppione")
        _ = e.next(now: now)
        XCTAssertNil(e.offer(event(.goalReached, "Timer che scorre", ago: -601), config: main, sessions: sessions, now: now.addingTimeInterval(601)),
                     "after 10 minutes it is news again")
    }

    func testOneVoiceAtATimeRisksFirstAndAShortQueue() {
        var e = VoiceAlertEngine()
        XCTAssertNil(e.offer(event(.goalReached, "a"), config: main, sessions: sessions, now: now))
        XCTAssertNil(e.offer(event(.custom, "b"), config: main, sessions: sessions, now: now))
        XCTAssertNil(e.offer(event(.risk, "c"), config: main, sessions: sessions, now: now))
        XCTAssertNil(e.offer(event(.question, "d"), config: main, sessions: sessions, now: now), "a question pushes out the least important")
        XCTAssertEqual(e.waiting.map(\.subject), ["c", "d", "b"])
        XCTAssertEqual(e.offer(event(.goalReached, "e"), config: main, sessions: sessions, now: now), "coda piena")
        XCTAssertNil(e.offer(event(.goalReached, "f", level: "alto"), config: main, sessions: sessions, now: now), "livello alto goes ahead")
        XCTAssertEqual(e.waiting.map(\.subject), ["c", "d", "f"], "risks and questions are alto too: they stay first")
        XCTAssertEqual(e.next(now: now)?.subject, "c")
        XCTAssertNil(e.offer(event(.goalReached, "e"), config: main, sessions: sessions, now: now), "refused before, so not a duplicate now")
    }

    func testOldNewsIsNeverSaid() {
        var e = VoiceAlertEngine()
        XCTAssertEqual(e.offer(event(.goalReached, "a", ago: 400), config: main, sessions: sessions, now: now), "vecchio")
        XCTAssertNil(e.offer(event(.goalReached, "b", ago: 200), config: main, sessions: sessions, now: now))
        XCTAssertNil(e.next(now: now.addingTimeInterval(200)), "it waited too long behind another voice")
    }

    // MARK: eventi.jsonl

    func testEventsFileLinesAndMark() {
        let a = #"{"v": 1, "id": "e-00000001", "t": 1792000000.5, "tipo": "richiesta_fatta", "sessione": {"cli": "m", "local_id": "local_m", "titolo": "T", "ruolo": "figlia"}, "soggetto": "Timer", "testo": "Fatto il timer", "prova": "PR #51", "livello": "normale", "giudizio": {"si": null, "motivo": "x"}}"#
        let b = #"{"v": 1, "id": "e-00000002", "t": 1792000001, "tipo": "merge", "soggetto": "x"}"#
        let c = #"{"v": 1, "id": "e-00000003", "t": 1792000002, "tipo": "rischio", "soggetto": "Account"#
        let data = Data((a + "\n" + b + "\nnot json\n" + c).utf8)
        XCTAssertEqual(VoiceEvents.newer(data, after: nil).events, [], "the launch only takes the mark")
        let first = VoiceEvents.newer(data, after: VoiceEvents.Mark(at: .distantPast, id: ""))
        XCTAssertEqual(first.events.count, 1, "a type the voice does not say, and a broken line, stay out")
        let e = first.events[0]
        XCTAssertEqual([e.id, e.session, e.localId, e.role, e.subject, e.proof, e.level], ["e-00000001", "m", "local_m", "figlia", "Timer", "PR #51", "normale"])
        XCTAssertTrue(e.judged, "giudizio present, even si null: never judged again")
        XCTAssertFalse(e.report.contains("51"), "the proof is never said")
        let rest = VoiceEvents.newer(data + Data(#""}"#.utf8) + Data("\n".utf8), after: first.mark)
        XCTAssertEqual(rest.events.map(\.kind), [.risk], "the half line waited for its end")
        XCTAssertEqual(rest.mark?.id, "e-00000003")
        let rewritten = Data((c + "\"}\n").utf8)
        XCTAssertEqual(VoiceEvents.newer(rewritten, after: first.mark).events.map(\.id), ["e-00000003"], "mark's line gone: what is newer than it")
        XCTAssertEqual(VoiceEvents.newer(rewritten, after: rest.mark).events, [], "nothing after the mark")
    }

    // MARK: derived without eventi.jsonl

    func goal(_ state: String, cli: String = "m") -> GoalRecord {
        GoalSources.parseGoal(Data(#"{"cli": "\#(cli)", "obiettivo": "Timer  che scorre", "stato": "\#(state)", "titolo": "★ Clotch", "prova": "PR #51"}"#.utf8))!
    }

    func testGoalReachedOrBlockedSinceTheLastLoad() {
        XCTAssertEqual(VoiceEvents.goals(before: nil, after: [goal("raggiunto")], now: now), [], "launch baseline")
        let e = VoiceEvents.goals(before: [goal("aperto"), goal("aperto", cli: "z")], after: [goal("raggiunto"), goal("bloccato", cli: "z")], now: now)
        XCTAssertEqual(e.map(\.kind), [.goalReached, .goalBlocked])
        XCTAssertEqual(e[0].subject, "Clotch")
        XCTAssertEqual(e[0].text, "Timer che scorre")
        XCTAssertEqual(e[0].proof, "PR #51")
        XCTAssertEqual(VoiceEvents.goals(before: [goal("raggiunto")], after: [goal("raggiunto")], now: now), [], "no change, no news")
    }

    func request(_ state: String, notOurs: Bool = false) -> UserRequest {
        GoalSources.parseRequest(Data(#"{"id": "Q-1", "testo": "Fixare il timer", "sessione": "m", "stato": "\#(state)", "prova": "PR #51", "non_nostra": \#(notOurs)}"#.utf8))!
    }

    func testRequestDoneSinceTheLastLoad() {
        let e = VoiceEvents.requests(before: [request("presa")], after: [request("fatta")], now: now)
        XCTAssertEqual(e.map(\.kind), [.requestDone])
        XCTAssertEqual(e.first?.proof, "PR #51")
        XCTAssertEqual(VoiceEvents.requests(before: nil, after: [request("fatta")], now: now), [])
        XCTAssertEqual(VoiceEvents.requests(before: [request("presa")], after: [request("fatta", notOurs: true)], now: now), [])
    }

    func quota(_ five: Double, _ seven: Double) -> AccountQuota {
        AccountQuota(email: "roberto@x", at: now, fiveHour: QuotaWindow(used: five, reset: now.addingTimeInterval(3600)),
                     sevenDay: QuotaWindow(used: seven, reset: now.addingTimeInterval(86_400)))
    }

    func testAccountRiskWhenAWindowCrosses80Or90() {
        let e = VoiceEvents.quotas(before: [quota(70, 85)], after: [quota(82, 91)], now: now)
        XCTAssertEqual(e.map(\.subject), ["Account roberto, 5 ore", "Account roberto, settimana"])
        XCTAssertEqual(e.map(\.level), ["alto", "alto"])
        XCTAssertEqual(VoiceEvents.quotas(before: [quota(82, 91)], after: [quota(85, 95)], now: now), [], "said once per threshold")
        XCTAssertEqual(VoiceEvents.quotas(before: nil, after: [quota(95, 95)], now: now), [])
    }

    func testQuestionFromTheDeclarationOrAnAnswerEndingWithAQuestionMark() {
        let declared = """
            {"type":"assistant","message":{"content":[{"type":"tool_use","name":"mcp__clean-view__giro_finito","input":{"fatto":["x"],"domande":["Prova il timer. Se va → chiudo. (sì)"]}}]}}
            {"type":"assistant","message":{"content":[{"type":"text","text":"Fatto."}]}}
            """
        XCTAssertEqual(VoiceEvents.question(session: "m", answer: "Fatto.", transcriptTail: Data(declared.utf8), now: now)?.text,
                       "Prova il timer. Se va → chiudo. (sì)")
        let none = #"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"mcp__clean-view__giro_finito","input":{"domande":[]}}]}}"#
        XCTAssertNil(VoiceEvents.question(session: "m", answer: "Vuoi altro?", transcriptTail: Data(none.utf8), now: now),
                     "the declaration says nothing to decide: silent, even with a «?»")
        XCTAssertEqual(VoiceEvents.question(session: "m", answer: "Ho finito. Quale account uso?", transcriptTail: nil, now: now)?.text, "Quale account uso?")
        XCTAssertNil(VoiceEvents.question(session: "m", answer: "Fatto, PR aperta.", transcriptTail: nil, now: now))
        let stop = VoiceEvents.stop(payload: Data(#"{"session_id": "m", "transcript_path": "/t"}"#.utf8), transcriptTail: { _ in Data(declared.utf8) }, now: now)
        XCTAssertEqual(stop?.session, "m")
        XCTAssertEqual(stop?.answer, "Fatto.")
        XCTAssertEqual(stop?.question?.kind, .question)
        XCTAssertNil(VoiceEvents.stop(payload: Data(#"{"session_id": "m", "stop_hook_active": true}"#.utf8), transcriptTail: { _ in nil }, now: now))
    }

    // MARK: «Avvisami quando…»

    func rule(_ when: VoiceAlertRule.When, _ value: String) -> VoiceAlertRule {
        VoiceAlertRule(id: "a1", text: "Avvisami quando finisce", when: when, value: value, created: now.addingTimeInterval(-60))
    }

    func testCustomRulesFireOnTheirFact() {
        var f = VoiceAlertRule.Facts(now: now)
        XCTAssertNil(rule(.word, "deploy").fires(f))
        f.answer = "Il Deploy è finito"
        XCTAssertEqual(rule(.word, "deploy").fires(f)?.kind, .custom)
        f.mergedPRs = [PRRef(repo: "SQUADD26/clotch", number: 51)]
        XCTAssertNotNil(rule(.prMerged, "#51").fires(f))
        XCTAssertNotNil(rule(.prMerged, "SQUADD26/clotch#51").fires(f))
        XCTAssertNil(rule(.prMerged, "other/repo#51").fires(f))
        f.fileExists = { $0 == "/tmp/fatto" }
        XCTAssertNotNil(rule(.file, "/tmp/fatto").fires(f))
        f.sessions = [session("local_m", cli: "m", idle: 700), session("local_b", cli: "b", running: true, idle: 700), session("local_n", cli: "n", idle: 30)]
        XCTAssertNotNil(rule(.sessionStill, "local_m").fires(f))
        XCTAssertNil(rule(.sessionStill, "b").fires(f), "running")
        XCTAssertNil(rule(.sessionStill, "n").fires(f), "active 30 s ago")

        let cal = Calendar.current
        let at = cal.dateComponents([.hour, .minute], from: now.addingTimeInterval(120))
        let hhmm = String(format: "%02d:%02d", at.hour!, at.minute!)
        XCTAssertNil(rule(.time, hhmm).fires(VoiceAlertRule.Facts(now: now)))
        XCTAssertNotNil(rule(.time, hhmm).fires(VoiceAlertRule.Facts(now: now.addingTimeInterval(180))))
        var fired = rule(.word, "deploy")
        fired.fired = true
        XCTAssertNil(fired.fires(f), "one-shot")
        var r = rule(.prMerged, "1854")
        r.repo = "SQUADD26/claude-config"
        f.mergedPRs = [PRRef(repo: "SQUADD26/claude-config", number: 1854)]
        XCTAssertEqual(r.fires(f)?.proof, "pr-fusa 1854", "repo from its own field")
        XCTAssertNil(VoiceAlertRule(id: "A-1", text: "t", when: nil, value: "", created: now).fires(f), "no `quando`: the Overseer's")
    }

    func testRulesFileKeepsUnknownFieldsAndRefusesABrokenOne() throws {
        let file = Data(#"{"v": 1, "nota": "mia", "regole": [{"id": "A-1b2c", "creata": 1792000000, "condizione": "quando 1854 è unita", "quando": {"tipo": "pr-fusa", "valore": "1854", "repo": "SQUADD26/claude-config"}, "stato": "attiva", "extra": 7}, {"id": "A-0000", "creata": 1792000000, "condizione": "a mano", "quando": null, "stato": "attiva"}]}"#.utf8)
        let rules = VoiceAlertRule.parse(file)
        XCTAssertEqual(rules.map(\.id), ["A-1b2c", "A-0000"])
        XCTAssertEqual(rules[0], VoiceAlertRule(id: "A-1b2c", text: "quando 1854 è unita", when: .prMerged, value: "1854",
                                                repo: "SQUADD26/claude-config", created: Date(timeIntervalSince1970: 1_792_000_000)))
        XCTAssertNil(rules[1].when)
        let fired = try XCTUnwrap(VoiceAlertRule.firing(["A-1b2c"], in: file))
        let o = try XCTUnwrap(JSONSerialization.jsonObject(with: fired) as? [String: Any])
        let first = try XCTUnwrap((o["regole"] as? [[String: Any]])?.first)
        XCTAssertEqual(first["stato"] as? String, "scattata")
        XCTAssertEqual(first["extra"] as? Int, 7, "a field Clotch does not know stays")
        XCTAssertEqual(o["nota"] as? String, "mia")
        let added = try XCTUnwrap(VoiceAlertRule.adding(VoiceAlertRule(id: "A-9999", text: "t", when: .time, value: "18:00", created: now), to: nil))
        XCTAssertEqual(VoiceAlertRule.parse(added), [VoiceAlertRule(id: "A-9999", text: "t", when: .time, value: "18:00", created: now)])
        XCTAssertEqual(VoiceAlertRule.parse(VoiceAlertRule.removing("A-0000", from: fired)).map(\.id), ["A-1b2c"])
        XCTAssertNil(VoiceAlertRule.adding(rules[0], to: Data("not json".utf8)), "a broken file is never overwritten")
        XCTAssertTrue(VoiceAlertRule.newId().hasPrefix("A-"))
    }

    // MARK: #1854 rules of the engine

    func testHigherLevelSameSubjectAndTheClosingPair() {
        var e = VoiceAlertEngine()
        XCTAssertNil(e.offer(event(.goalReached, "Timer"), config: main, sessions: sessions, now: now))
        XCTAssertNil(e.offer(event(.goalBlocked, "timer"), config: main, sessions: sessions, now: now), "livello più alto: said")
        XCTAssertEqual(e.offer(event(.goalBlocked, "Timer"), config: main, sessions: sessions, now: now), "doppione")
        var p = VoiceAlertEngine()
        XCTAssertNil(p.offer(event(.requestDone, "Fixare il timer"), config: main, sessions: sessions, now: now))
        XCTAssertEqual(p.offer(event(.goalReached, "Clotch"), config: main, sessions: sessions, now: now), "doppione",
                       "a request done and a goal reached of one session: the first")
        XCTAssertNil(p.offer(event(.goalReached, "Altro", session: "z"), config: VoiceTurn.Config(["parla_per": "tutte"]), sessions: sessions, now: now))
    }

    func testParlaPerUsesRoleAndLocalId() {
        var e = event(.requestDone, "x", session: "c")
        e.role = "master"
        XCTAssertTrue(main.speaks(e, sessions: sessions), "ruolo master wins over the session file")
        e.role = "figlia"
        XCTAssertFalse(main.speaks(e, sessions: sessions))
        e.role = "overseer"
        XCTAssertTrue(main.speaks(e, sessions: sessions))
        var one = event(.requestDone, "x", session: "zz")
        one.localId = "local_q"
        XCTAssertTrue(VoiceTurn.Config(["parla_per": "una", "sessione": "local_q"]).speaks(one, sessions: sessions))
        XCTAssertFalse(VoiceTurn.Config(["parla_per": "una", "sessione": "local_m"]).speaks(one, sessions: sessions))
    }
}
