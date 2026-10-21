import XCTest
@testable import CodeIslandCore

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

    func event(_ kind: VoiceEvent.Kind, _ subject: String, session: String = "m", ago: Double = 5, level: String = "") -> VoiceEvent {
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
        XCTAssertNil(e.offer(event(.requestDone, "b"), config: main, sessions: sessions, now: now))
        XCTAssertNil(e.offer(event(.risk, "c"), config: main, sessions: sessions, now: now))
        XCTAssertNil(e.offer(event(.question, "d"), config: main, sessions: sessions, now: now), "a question pushes out the least important")
        XCTAssertEqual(e.waiting.map(\.subject), ["c", "d", "b"])
        XCTAssertEqual(e.offer(event(.goalReached, "e"), config: main, sessions: sessions, now: now), "coda piena")
        XCTAssertNil(e.offer(event(.goalReached, "f", level: "alto"), config: main, sessions: sessions, now: now), "livello alto goes ahead")
        XCTAssertEqual(e.next(now: now)?.subject, "f")
        XCTAssertNil(e.offer(event(.goalReached, "e"), config: main, sessions: sessions, now: now), "refused before, so not a duplicate now")
    }

    func testOldNewsIsNeverSaid() {
        var e = VoiceAlertEngine()
        XCTAssertEqual(e.offer(event(.goalReached, "a", ago: 400), config: main, sessions: sessions, now: now), "vecchio")
        XCTAssertNil(e.offer(event(.goalReached, "b", ago: 200), config: main, sessions: sessions, now: now))
        XCTAssertNil(e.next(now: now.addingTimeInterval(200)), "it waited too long behind another voice")
    }

    // MARK: eventi.jsonl

    func testEventsFileLinesAndOffsets() {
        let a = #"{"t": "2026-10-21T19:40:00+0200", "tipo": "richiesta_fatta", "sessione": {"cli": "m", "local_id": "local_m", "titolo": "T"}, "soggetto": "Timer", "testo": "Fatto il timer", "prova": "PR #51", "livello": "normale"}"#
        let b = #"{"t": 1792000000, "tipo": "merge", "soggetto": "x"}"#
        let c = #"{"t": 1792000000, "tipo": "rischio", "soggetto": "Account"#
        let data = Data((a + "\n" + b + "\nnot json\n" + c).utf8)
        let first = VoiceEvents.appended(data, from: 0)
        XCTAssertEqual(first.events.count, 1, "a type the voice does not say, and a broken line, stay out")
        XCTAssertEqual(first.events[0], VoiceEvent(kind: .requestDone, at: GoalSources.date("2026-10-21T19:40:00+0200")!, session: "m",
                                                   subject: "Timer", text: "Fatto il timer", proof: "PR #51", level: "normale"))
        XCTAssertEqual(first.events[0].report, "Richiesta fatta: Fatto il timer. Prova: la modifica.", "cleaned for the ear")
        let rest = VoiceEvents.appended(data + Data(#"", "testo": "90%"}"#.utf8) + Data("\n".utf8), from: first.offset)
        XCTAssertEqual(rest.events.map(\.kind), [.risk], "the half line waited for its end")
        XCTAssertEqual(VoiceEvents.appended(Data((a + "\n").utf8), from: 10_000).events.count, 1, "a shorter file was rewritten: from the start")
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
        XCTAssertEqual(e.map(\.subject), ["Account roberto, 5 ore", "Account roberto, 7 giorni"])
        XCTAssertEqual(e.map(\.level), ["", "alto"])
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
        f.mergedPRs = [PRRef(repo: "SQUADD26/goal-notch", number: 51)]
        XCTAssertNotNil(rule(.prMerged, "#51").fires(f))
        XCTAssertNotNil(rule(.prMerged, "SQUADD26/goal-notch#51").fires(f))
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
        fired.fired = now
        XCTAssertNil(fired.fires(f), "one-shot")
    }

    func testRulesFileRoundTrip() {
        var r = rule(.prMerged, "#51")
        r.created = Date(timeIntervalSince1970: 1_792_000_000)
        let back = VoiceAlertRule.parse(VoiceAlertRule.encode([r]))
        XCTAssertEqual(back, [r])
        XCTAssertEqual(VoiceAlertRule.parse(Data(#"{"avvisi": [{"id": "x", "testo": "t", "quando": "luna"}]}"#.utf8)), [], "an unknown kind stays out")
        XCTAssertEqual(VoiceAlertRule.parse(nil), [])
    }
}
