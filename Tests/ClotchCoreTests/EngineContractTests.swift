import XCTest
@testable import ClotchCore

/// The contract with the engine (claude-config#1921): the files below were written by the engine's own code
/// (claude-config `global/hooks/test_contratto_clotch.py --aggiorna`) and are read here by Clotch's own parsers.
/// If the engine renames or retypes a field, its test goes red; if a parser here stops reading one, this does.
/// Keep `Tests/Fixtures/motore/` identical to claude-config `global/hooks/contratto-clotch/`.
final class EngineContractTests: XCTestCase {
    private func fixture(_ name: String) throws -> Data {
        let dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
        return try Data(contentsOf: dir.appendingPathComponent("Fixtures/motore/\(name)"))
    }

    /// clotch#260: the contract number `scripts/controlla-motore.sh` compares with `motore versione` ("N <fingerprint of the other files>").
    func testContractVersionNumber() throws {
        let words = try XCTUnwrap(String(data: fixture("VERSIONE"), encoding: .utf8)).split(whereSeparator: \.isWhitespace)
        XCTAssertEqual(words.count, 2)
        XCTAssertGreaterThanOrEqual(Int(words[0]) ?? 0, 1)
    }

    func testTaskRequestTakenAnsweredAndDone() throws {
        let r = try XCTUnwrap(GoalSources.parseRequest(fixture("richiesta-compito.json")))
        XCTAssertEqual(r.id, "Q-a2ab1959")
        XCTAssertEqual(r.at, Date(timeIntervalSince1970: 1792000000.5), "`t` is epoch seconds")
        XCTAssertEqual([r.state, r.kind, r.takenBy, r.proof, r.session], ["fatta", "compito", "cli-2", "PR #12", "cli-1"])
        XCTAssertEqual(r.answer, "Fatto: il notch si vede.")
        XCTAssertNotNil(r.takenAt); XCTAssertNotNil(r.doneAt); XCTAssertNotNil(r.answeredAt)
        XCTAssertFalse(r.notOurs)
        XCTAssertEqual(r.look, .done)
    }

    func testQuestionRequestIsListedWhileUnanswered() throws {
        let r = try XCTUnwrap(GoalSources.parseRequest(fixture("richiesta-domanda.json")))
        XCTAssertTrue(r.isQuestion)
        XCTAssertEqual(r.state, "nuova")
        XCTAssertNil(r.takenAt, "null stays nil"); XCTAssertNil(r.answeredAt); XCTAssertEqual(r.answer, "")
        XCTAssertEqual(UserRequest.listed([r], now: Date(timeIntervalSince1970: 1792000100)).map(\.id), [r.id])
    }

    /// #199: the Requests tab lists what the engine says is open, with the engine's own state, point and exit time.
    func testRequestsTabListsWhatTheEngineLeavesOpen() throws {
        func req(_ name: String, _ edit: (inout [String: Any]) -> Void = { _ in }) throws -> UserRequest {
            var d = try XCTUnwrap(JSONSerialization.jsonObject(with: fixture(name)) as? [String: Any])
            edit(&d)
            return try XCTUnwrap(GoalSources.parseRequest(JSONSerialization.data(withJSONObject: d)))
        }
        let stuck = try req("richiesta-ferma.json"), question = try req("richiesta-domanda.json")
        let doneInTime = try req("richiesta-compito.json")                      // esce_t = t_fatta + 24 h
        let doneNoExit = try req("richiesta-compito.json") { $0["esce_t"] = NSNull(); $0["id"] = "Q-1" }
        let takenQuiet = try req("richiesta-compito.json") { $0["stato"] = "presa"; $0["esce_t"] = NSNull(); $0["id"] = "Q-2" }  // listed since #261
        let takenAsking = try req("richiesta-compito.json") {
            $0["stato"] = "presa"; $0["esce_t"] = NSNull(); $0["id"] = "Q-3"
            $0["aspetta_te"] = true; $0["punto"] = "Tengo il colore o lo cambio?"
        }
        let exit = try XCTUnwrap(doneInTime.leavesAt), all = [stuck, question, doneInTime, doneNoExit, takenQuiet, takenAsking]
        let justDone = try XCTUnwrap(doneInTime.doneAt).addingTimeInterval(60)
        XCTAssertEqual(UserRequest.listed(all, now: justDone).map(\.id), [stuck.id, question.id, "Q-2", "Q-3", doneInTime.id],
                       "open ones first (every taken one, asking or not), then the done one; a done one without esce_t is out")
        XCTAssertEqual(UserRequest.listed(all, now: exit.addingTimeInterval(-60)).map(\.id), [stuck.id, question.id, "Q-2", "Q-3"],
                       "#261: a done one leaves a few minutes after t_fatta, not at esce_t (24 h)")
        XCTAssertEqual([stuck.statusLabel, takenAsking.statusLabel], ["Ferma", "In attesa di te"])
        XCTAssertEqual([stuck.point, takenAsking.point, doneInTime.point], ["La sessione è chiusa.", "Tengo il colore o lo cambio?", "Fatto: il notch si vede."])
    }

    /// clotch#223: `richieste.py vista` (claude-config#2107) is a JSON array of the open requests, each one a register record
    /// with `punto`, `aspetta_te`, `ferma_perche`; every row is read by the one request parser, none dropped.
    /// `titolo_prove` (clotch#188, the engine's count of title tries) sits in `richiesta-compito.json` and is ignored on purpose.
    func testEngineOpenRequestsViewIsRead() throws {
        let rows = try XCTUnwrap(JSONSerialization.jsonObject(with: fixture("vista-richieste.json")) as? [[String: Any]])
        let list = try rows.map { try XCTUnwrap(GoalSources.parseRequest(JSONSerialization.data(withJSONObject: $0))) }
        XCTAssertEqual(list.count, rows.count)
        let r = try XCTUnwrap(list.first)
        XCTAssertEqual([r.id, r.state, r.kind, r.takenBy, r.point], ["Q-5ef8766d", "ferma", "compito", "Login da rifare", "La sessione è chiusa."])
        // clotch#261: `presa_da` is the taker's title, never a cli id; the same row taken (nobody waits on it) is listed with who does it.
        var row = rows[0]; row["stato"] = "presa"; row["ferma_perche"] = ""; row["punto"] = "Sto rifacendo il login."
        let taken = try XCTUnwrap(GoalSources.parseRequest(JSONSerialization.data(withJSONObject: row)))
        XCTAssertEqual(UserRequest.listed([taken], now: Date(timeIntervalSince1970: 1792000100)).map { [$0.takenBy, $0.point] }, [["Login da rifare", "Sto rifacendo il login."]])
        XCTAssertEqual(r.look, .stuck); XCTAssertFalse(r.waitsForYou)
        XCTAssertEqual(try XCTUnwrap(JSONSerialization.jsonObject(with: fixture("richiesta-compito.json")) as? [String: Any])["titolo_prove"] as? Int, 1)
    }

    func testAdhdListIsRead() throws {
        let list = GoalSources.parseAdhd(try fixture("adhd-elenco.json"))
        let r = try XCTUnwrap(list.first)
        XCTAssertEqual([r.id, r.question, r.answer], ["Q-b532a544", "Perche' il notch e' nero?", "Perche' manca il tema scuro."])
        XCTAssertEqual(r.times, 2); XCTAssertNotNil(r.at)
        XCTAssertTrue(r.answered); XCTAssertEqual(AdhdRequest.unansweredCount(list), 0)
        XCTAssertEqual(GoalSources.parseAdhd(Data("[]".utf8)), []); XCTAssertEqual(GoalSources.parseAdhd(Data("no".utf8)), [])
    }

    func testAdhdWhoAnsweredAndWhichSessionOwesIt() throws {
        let r = try XCTUnwrap(GoalSources.parseAdhd(try fixture("adhd-elenco.json")).first)
        XCTAssertEqual([r.answeredBy, r.state, r.session, r.localId, r.sessionTitle], ["ereditata", "con_risposta", "cli-1", "", ""])
        XCTAssertEqual(r.ids, ["Q-bfeb734d", "Q-b532a544"]); XCTAssertEqual(r.nudgedAt, Date(timeIntervalSince1970: 1792654603.828331))
        XCTAssertEqual(r.answerNote, "Già risposta prima")
        let h = try XCTUnwrap(GoalSources.parseAdhd(Data(#"[{"id":"Q-2","domanda_chiara":"D?","risposta":"x","risposta_da":"haiku","local_id":"local_a","titolo_sessione":"⌘ Clotch: x"}]"#.utf8)).first)
        XCTAssertEqual([h.answerNote, h.localId], ["Risposta provvisoria", "local_a"])
        XCTAssertNil(GoalSources.parseAdhd(Data(#"[{"id":"Q-3","domanda_chiara":"D?","risposta_da":"sessione"}]"#.utf8))[0].answerNote, "the session's own answer says nothing")
    }

    func testMarkAllReadSendsOnlyTheIdsShown() {
        let list = GoalSources.parseAdhd(Data(#"[{"id":"Q-1","domanda_chiara":"A?","risposta":"x"},{"id":"Q-2","domanda_chiara":"B?"},{"id":"Q-3","domanda_chiara":"C?","risposta":"y"}]"#.utf8))
        XCTAssertEqual(AdhdRequest.markReadArguments(nil, in: list, home: "/h"),
                       [["/h/.claude/hooks/richieste.py", "letta", "Q-1"], ["/h/.claude/hooks/richieste.py", "letta", "Q-3"]],
                       "never `--tutte`: an answer that landed after the list was drawn stays unread (#171)")
        XCTAssertEqual(AdhdRequest.markReadArguments("Q-3", in: list, home: "/h"), [["/h/.claude/hooks/richieste.py", "letta", "Q-3"]])
    }

    func testAdhdWaitingLabelAndBadge() {
        func one(_ extra: String) -> AdhdRequest {
            GoalSources.parseAdhd(Data(#"[{"id":"Q-1","domanda_chiara":"Domanda?","risposta":"",\#(extra)}]"#.utf8))[0]
        }
        XCTAssertEqual(one(#""responsabile":"Clotch","origine":"x","da_smistare":false"#).waitingLabel, "In attesa di Clotch")
        XCTAssertEqual(one(#""responsabile":"","origine":"Notch","da_smistare":false"#).waitingLabel, "In attesa di Notch")
        XCTAssertEqual(one(#""da_smistare":true"#).waitingLabel, "Da smistare · clotch AI")
        XCTAssertEqual(one(#""stato":"sollecitata","da_smistare":false"#).waitingLabel, "Sollecitata · aspetto la risposta")
        XCTAssertEqual(AdhdRequest.unansweredCount([one(#""da_smistare":true"#)]), 1)
    }

    func testGoalWithProofsActivityAndProposal() throws {
        let g = try XCTUnwrap(GoalSources.parseGoal(fixture("obiettivo.json")))
        XCTAssertEqual([g.cli, g.state, g.title], ["cli-9", "aperto", "★ Clotch: prove"])
        XCTAssertEqual(g.proofs?.map(\.done), [true, false])
        XCTAssertEqual(g.proofs?.first?.text, "Il test passa")
        XCTAssertNotNil(g.proofs?.first?.at, "proof `t` is ISO with +0000")
        XCTAssertNotNil(g.at); XCTAssertNotNil(g.lastSeen, "`ultima_attivita`")
        XCTAssertEqual(g.proposal, "Il notch mostra anche le richieste: la pagina R mostra S e il test passa")
        XCTAssertTrue(g.valid, "`valido`: true in the engine's own file")
    }

    /// clotch#183: `valido: false` (wrong signature, lost key, expired legacy date) = the engine treats it as unsigned; never a live goal.
    func testGoalTheEngineCallsInvalidIsNotShown() throws {
        var o = try XCTUnwrap(JSONSerialization.jsonObject(with: fixture("obiettivo.json")) as? [String: Any])
        o["valido"] = false
        let bad = try XCTUnwrap(GoalSources.parseGoal(JSONSerialization.data(withJSONObject: o)))
        XCTAssertFalse(bad.valid)
        let session = DesktopSession(localId: "local_x", cliId: "cli-9", parentLocalId: nil, priorCliIds: [], title: "", isRunning: true,
                                     isArchived: false, lastActivity: Date(), prs: [])
        let now = Date()
        let good = try XCTUnwrap(GoalSources.parseGoal(fixture("obiettivo.json")))
        XCTAssertEqual(GoalBoard.rows(goals: [good], sessions: [session], live: [], now: now).map(\.id), ["cli-9"])
        XCTAssertEqual(GoalBoard.rows(goals: [bad], sessions: [session], live: [], now: now), [], "hidden, never alive with a bar")
        o["valido"] = nil
        XCTAssertTrue(try XCTUnwrap(GoalSources.parseGoal(JSONSerialization.data(withJSONObject: o))).valid, "an older file with no field stays valid")
    }

    func testGoalStalledFieldsAreRead() throws {
        var o = try XCTUnwrap(JSONSerialization.jsonObject(with: fixture("obiettivo.json")) as? [String: Any])
        o["fermo_da"] = "2026-10-21T19:00:00+0300"; o["perche"] = "esce 1: test rosso"; o["segnalato"] = "S-0001"
        let g = try XCTUnwrap(GoalSources.parseGoal(JSONSerialization.data(withJSONObject: o)))
        XCTAssertNotNil(g.stalledSince); XCTAssertEqual(g.stalledReason, "esce 1: test rosso")
    }

    func testLiveAgents() throws {
        let l = try XCTUnwrap(GoalSources.parseLive(fixture("live.json"), cliId: "cli-9"))
        XCTAssertNotNil(l.updated, "`aggiornato` is ISO without a zone")
        XCTAssertEqual(l.agents.map(\.id), ["a1", "a2"])
        XCTAssertEqual(l.agents.map(\.alive), [true, false])
        XCTAssertNotNil(l.agents[0].lastActivity)
    }

    func testVoiceEventLine() throws {
        let o = try JSONSerialization.jsonObject(with: fixture("evento.json"))
        let line = String(decoding: try JSONSerialization.data(withJSONObject: o), as: UTF8.self)
        let e = try XCTUnwrap(VoiceEvents.parse(line: Substring(line)))
        XCTAssertEqual(e.kind, .question)
        XCTAssertEqual([e.id, e.session, e.level, e.subject, e.proof], ["e-cb57711e", "cli-9", "alto", "fondere la PR", "PR #12"])
        XCTAssertFalse(e.judged)
        XCTAssertEqual(e.at.timeIntervalSince1970, 1792654603.866, accuracy: 0.001)
    }

    /// A line the engine's own `eventi_voce.py scrivi` wrote (claude-config main 478b6df), parsed by Clotch.
    private func engineLine(_ json: String) throws -> VoiceEvent { try XCTUnwrap(VoiceEvents.parse(line: Substring(json))) }

    func testAdhdAnswerIsSaidUrgent() throws {
        // eventi_voce.py scrivi risposta_adhd "Risposta a: …" --soggetto … --prova Q-b532a544 (richieste_adhd.py#L111, #163)
        let e = try engineLine(#"{"v": 1, "id": "e-9d76d56c", "t": 1792653719.373, "tipo": "risposta_adhd", "livello": "alto", "soggetto": "Perche' il notch e' nero?", "testo": "Risposta a: Perche' il notch e' nero? Perche' manca il tema scuro.", "prova": "Q-b532a544"}"#)
        XCTAssertEqual(e.kind, .adhdAnswer)
        XCTAssertEqual([e.level, e.subject, e.proof], ["alto", "Perche' il notch e' nero?", "Q-b532a544"])
        XCTAssertTrue(e.report.contains("manca il tema scuro"))
        XCTAssertFalse(e.report.contains("Q-b532a544"), "the proof is never said")
        XCTAssertEqual(VoiceEvent(kind: .adhdAnswer, at: e.at).level, "alto", "derived like the engine: alto")
        XCTAssertFalse(VoiceJudge.judges(e), "Roberto asked for it: never judged as noise")
    }

    func testStalledDependencyIsSaidUrgent() throws {
        // eventi_voce.py scrivi dipendenza_ferma "Una sessione aspetta te da troppo: …" --soggetto … --prova D-… --cli cli-8 (dipendenze.py#L210, #164)
        let e = try engineLine(#"{"v": 1, "id": "e-b04289c4", "t": 1792653719.404, "tipo": "dipendenza_ferma", "livello": "alto", "sessione": {"cli": "cli-8", "local_id": "", "titolo": "", "ruolo": ""}, "soggetto": "Clotch, voce", "testo": "Una sessione aspetta te da troppo: la chiave di ElevenLabs.", "prova": "D-1a2b3c4d"}"#)
        XCTAssertEqual(e.kind, .stalledDependency)
        XCTAssertEqual([e.level, e.session, e.subject, e.proof], ["alto", "cli-8", "Clotch, voce", "D-1a2b3c4d"])
        XCTAssertTrue(e.report.contains("la chiave di ElevenLabs"))
        XCTAssertFalse(e.report.contains("D-1a2b3c4d"), "the proof is never said")
        XCTAssertEqual(VoiceEvent(kind: .stalledDependency, at: e.at).level, "alto")
        XCTAssertFalse(VoiceJudge.judges(e), "it waits on Roberto: never judged as noise")
    }

    func testWaitsForOkIsSaidAsAQuestion() throws {
        // eventi_voce.py scrivi aspetta_ok "<sessione> aspetta un tuo ok per …" --soggetto … --prova <local_id> --cli cli-7 (dipendenze.py#L84-L89, #162)
        let e = try engineLine(#"{"v": 1, "id": "e-78ce5792", "t": 1792653719.331, "tipo": "aspetta_ok", "livello": "alto", "sessione": {"cli": "cli-7", "local_id": "", "titolo": "", "ruolo": ""}, "soggetto": "Clotch, correzioni", "testo": "Clotch, correzioni aspetta un tuo ok per fondere la PR: vuoi che glielo dia io?", "prova": "local_abc123"}"#)
        XCTAssertEqual(e.kind, .waitsForOk)
        XCTAssertEqual([e.level, e.session, e.subject, e.proof], ["alto", "cli-7", "Clotch, correzioni", "local_abc123"])
        XCTAssertTrue(e.report.contains("vuoi che glielo dia io?"))
        XCTAssertFalse(e.report.contains("local_abc123"), "the proof is never said")
        XCTAssertEqual(e.kind.rank, VoiceEvent.Kind.question.rank, "said like a question")
        XCTAssertFalse(VoiceJudge.judges(e))
        // MAI_UNITI: another urgent event of the same session never covers it (#1982).
        var engine = VoiceAlertEngine()
        let now = e.at.addingTimeInterval(1), all = VoiceTurn.Config(["parla_per": "tutte"])
        let blocked = VoiceEvent(kind: .goalBlocked, at: e.at, session: "cli-7", subject: "Clotch, correzioni", text: "bloccato")
        XCTAssertNil(engine.offer(blocked, config: all, sessions: [], now: now))
        XCTAssertNil(engine.offer(e, config: all, sessions: [], now: now), "not a duplicate of the other event")
        XCTAssertEqual(engine.offer(e, config: all, sessions: [], now: now), "doppione", "the same ok twice is said once")
    }

    func testEveryKindTheEngineWritesIsKnown() {
        // claude-config eventi_voce.LIVELLO
        let engine: Set<String> = ["richiesta_fatta", "obiettivo_raggiunto", "obiettivo_bloccato", "fine_turno", "domanda", "rischio", "avviso_custom",
                                   "risposta_adhd", "dipendenza_ferma", "aspetta_ok"]
        XCTAssertEqual(Set(VoiceEvent.Kind.allCases.map(\.rawValue)), engine)
    }

    func testAlertRuleAndFiringStampsTheTime() throws {
        let data = try fixture("avvisi.json")
        let r = try XCTUnwrap(VoiceAlertRule.parse(data).first)
        XCTAssertEqual([r.id, r.value, r.repo], ["A-29ae", "12", "SQUADD26/clotch"])
        XCTAssertEqual(r.when, .prMerged); XCTAssertFalse(r.fired)
        let now = Date(timeIntervalSince1970: 1792100000)
        let fired = try XCTUnwrap(VoiceAlertRule.firing(["A-29ae"], in: data, now: now))
        let row = try XCTUnwrap(((JSONSerialization.jsonObject(with: fired) as? [String: Any])?["regole"] as? [[String: Any]])?.first)
        XCTAssertEqual(row["stato"] as? String, "scattata")
        XCTAssertEqual(row["scattata"] as? Int, 1792100000, "avvisi_voce.py prunes a fired rule 7 days after `scattata`")
        XCTAssertEqual(row["creata"] as? Int, 1792000000, "fields Clotch does not own stay")
    }

    func testVoiceStatusAsTheModWritesIt() throws {
        // clean-view/hooks/voce-io.ts statoVoce(): {v, passo_ms, id, parla, t_inizio, t_fine, livello} in epoch ms
        let s = try XCTUnwrap(VoiceStatus.parse(Data(#"{"v":1,"passo_ms":50,"id":"1-ab","parla":true,"t_inizio":1792000000500,"t_fine":1792000003500,"livello":[0.1,0.9]}"#.utf8)))
        XCTAssertEqual(s.start, Date(timeIntervalSince1970: 1792000000.5))
        XCTAssertTrue(s.isSpeaking(at: Date(timeIntervalSince1970: 1792000002)))
        XCTAssertNil(VoiceStatus.parse(Data(#"{"v":1,"passo_ms":50,"id":"1-ab","parla":false,"t_inizio":0,"t_fine":0,"livello":[]}"#.utf8)), "the closing write")
    }

    func testDayKeepsWhatCleanViewWrote() throws {
        let mod = Data(#"{"giorno":"2026-10-21","chiamate":2,"caratteri":50,"recenti":[{"k":"a","ts":1}],"avvisato":"x","ultimo":{"ts":1,"parla":true,"perche":"detta"}}"#.utf8)
        let day = VoiceTurn.Day(giorno: "2026-10-21", chiamate: 3, caratteri: 80)
        let o = try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(day.merged(into: mod))) as? [String: Any])
        XCTAssertEqual([o["chiamate"] as? Int, o["caratteri"] as? Int], [3, 80])
        XCTAssertNotNil(o["recenti"]); XCTAssertEqual(o["avvisato"] as? String, "x"); XCTAssertNotNil(o["ultimo"])
        let next = try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(VoiceTurn.Day(giorno: "2026-10-22").merged(into: mod))) as? [String: Any])
        XCTAssertNil(next["ultimo"], "a new day, like Clean View"); XCTAssertNotNil(next["recenti"])
    }

    // MARK: the engine's vocabulary (clotch#167): a new type or state in the engine is a red test here

    private func vocabulary(_ key: String) throws -> [String: Any] {
        let all = try XCTUnwrap(JSONSerialization.jsonObject(with: fixture("vocabolario.json")) as? [String: Any])
        return try XCTUnwrap(all[key] as? [String: Any], key)
    }

    func testEveryEventTypeOfTheEngineIsReadOrIgnoredOnPurpose() throws {
        let types = try vocabulary("evento.tipo")
        for (tipo, how) in types {
            let verdict = (how as? [String: Any])?["clotch"] as? String ?? ""
            XCTAssertTrue(VoiceEvent.Kind(rawValue: tipo) != nil || verdict.hasPrefix("ignorato:"),
                          "engine event type «\(tipo)» is neither a VoiceEvent.Kind nor ignored with a reason")
        }
        for kind in VoiceEvent.Kind.allCases { XCTAssertNotNil(types[kind.rawValue], "«\(kind.rawValue)» is not in the engine's vocabulary") }
    }

    func testEverySessionStateOfTheEngineIsAPhase() throws {
        let states = try vocabulary("stato-sessione.stato")
        for raw in states.keys { XCTAssertNotNil(SessionPhase(contract: raw), "session state «\(raw)»") }
        XCTAssertEqual(Set(states.keys), Set(SessionPhase.allCases.map(\.rawValue)))
    }

    func testSessionStateFileIsRead() throws {
        let m = try XCTUnwrap(GoalSources.parseMotor(fixture("stato-sessione.json"), cli: "x"))
        XCTAssertEqual([m.cli, m.phase.rawValue, m.why], ["cli-9", "aspetta_roberto", "Ti chiede: posso fondere?"])
        XCTAssertEqual(m.questions, ["Posso fondere?"]); XCTAssertEqual(m.errors, 0); XCTAssertNotNil(m.since); XCTAssertNotNil(m.seen)
        XCTAssertEqual(m.askLine, "Ti chiede: Posso fondere?")
    }

    func testEveryRequestAndAdhdStateParses() throws {
        for name in ["richiesta-compito", "richiesta-domanda", "richiesta-adhd", "richiesta-ferma"] {
            XCTAssertNotNil(GoalSources.parseRequest(try fixture(name + ".json")), name)
        }
        let known: Set<String> = ["nuova", "presa", "fatta", "ferma"]
        XCTAssertTrue(Set(try vocabulary("richiesta.stato").keys).isSubset(of: known), "a new request state needs a look in UserRequest")
        let adhd = Set(try vocabulary("adhd.stato").keys)
        XCTAssertEqual(adhd, ["aperta", "con_risposta", "sollecitata"], "a new ADHD state needs a look")
    }
}
