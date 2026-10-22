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

    func testAdhdListIsRead() throws {
        let list = GoalSources.parseAdhd(try fixture("adhd-elenco.json"))
        let r = try XCTUnwrap(list.first)
        XCTAssertEqual([r.id, r.question, r.answer], ["Q-b532a544", "Perche' il notch e' nero?", "Perche' manca il tema scuro."])
        XCTAssertEqual(r.times, 2); XCTAssertNotNil(r.at)
        XCTAssertTrue(r.answered); XCTAssertEqual(AdhdRequest.unansweredCount(list), 0)
        XCTAssertEqual(GoalSources.parseAdhd(Data("[]".utf8)), []); XCTAssertEqual(GoalSources.parseAdhd(Data("no".utf8)), [])
    }

    func testAdhdWaitingLabelAndBadge() {
        func one(_ extra: String) -> AdhdRequest {
            GoalSources.parseAdhd(Data(#"[{"id":"Q-1","domanda_chiara":"Domanda?","risposta":"",\#(extra)}]"#.utf8))[0]
        }
        XCTAssertEqual(one(#""responsabile":"Clotch","origine":"x","da_smistare":false"#).waitingLabel, "In attesa di Clotch")
        XCTAssertEqual(one(#""responsabile":"","origine":"Notch","da_smistare":false"#).waitingLabel, "In attesa di Notch")
        XCTAssertEqual(one(#""da_smistare":true"#).waitingLabel, "Da smistare · Overseer")
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
        XCTAssertEqual([e.id, e.session, e.level, e.subject, e.proof], ["e-81788521", "cli-9", "alto", "fondere la PR", "PR #12"])
        XCTAssertFalse(e.judged)
        XCTAssertEqual(e.at.timeIntervalSince1970, 1792610025.501, accuracy: 0.001)
    }

    func testEveryKindTheEngineWritesIsKnown() {
        // claude-config eventi_voce.LIVELLO
        let engine: Set<String> = ["richiesta_fatta", "obiettivo_raggiunto", "obiettivo_bloccato", "fine_turno", "domanda", "rischio", "avviso_custom"]
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
}
