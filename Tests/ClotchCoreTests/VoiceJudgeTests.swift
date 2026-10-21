import XCTest
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
@testable import ClotchCore

/// #57: the Jev judge before the voice speaks (claude-config#1854 «Giudice»): yes, no, no key, timeout.
final class VoiceJudgeTests: XCTestCase {
    let now = Date(timeIntervalSince1970: 1_792_000_000)
    let state = ["richieste": "r", "stato": "s", "segnale": "x"]

    func answer(_ p: Double) -> @Sendable (URLRequest) async throws -> Data {
        { _ in Data(#"{"answers": {"q": {"noul": \#(p)}}}"#.utf8) }
    }

    func testYesAndNo() async {
        let yes = await VoiceJudge.judge(state: state, key: "k", question: "q?", ask: answer(0.82))
        XCTAssertEqual(yes, VoiceJudge.Verdict(say: true, reason: "Jev: P=0.82, soglia 0.5", p: 0.82))
        let no = await VoiceJudge.judge(state: state, key: "k", question: "q?", ask: answer(0.1))
        XCTAssertEqual(no.say, false)
        let odd = await VoiceJudge.judge(state: state, key: "k", question: "q?") { _ in Data("{}".utf8) }
        XCTAssertNil(odd.say, "an unclear answer: not reached")
    }

    func testNoKeyNeverCalls() async {
        let v = await VoiceJudge.judge(state: state, key: nil, question: "q?") { _ in XCTFail("called without a key"); return Data() }
        XCTAssertEqual(v.say, nil)
        XCTAssertEqual(v.reason, "giudice non raggiunto: nessuna chiave")
    }

    func testNoQuestionFileNeverCalls() async {
        // #84: the question is the config's file; without it the judge is not asked, never a copy.
        let v = await VoiceJudge.judge(state: state, key: "k", question: nil) { _ in XCTFail("called without the question"); return Data() }
        XCTAssertEqual(v, VoiceJudge.Verdict(say: nil, reason: "giudice non raggiunto: nessuna domanda", p: nil))
    }

    func testTimeoutAndError() async {
        let start = Date()
        let slow = await VoiceJudge.judge(state: state, key: "k", question: "q?", timeout: 0.2) { _ in
            try await Task.sleep(nanoseconds: 5_000_000_000)
            return Data(#"{"answers": {"q": {"noul": 0.9}}}"#.utf8)
        }
        XCTAssertNil(slow.say)
        XCTAssertLessThan(Date().timeIntervalSince(start), 2, "it does not wait for Jev past the timeout")
        let failed = await VoiceJudge.judge(state: state, key: "k", question: "q?") { _ in throw URLError(.notConnectedToInternet) }
        XCTAssertNil(failed.say)
    }

    func testRequestShapeAndLogNeverHoldTheKey() throws {
        let r = VoiceJudge.request(key: "sekret", question: "Serve dirlo?", state: state)
        XCTAssertEqual(r.value(forHTTPHeaderField: "Authorization"), "Bearer sekret")
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: r.httpBody ?? Data()) as? [String: Any])
        XCTAssertEqual(body["model"] as? String, "jev-1.13.0")
        XCTAssertEqual(((body["questions"] as? [String: Any])?["q"] as? [String: Any])?["type"] as? String, "noul")
        XCTAssertEqual(((body["questions"] as? [String: Any])?["q"] as? [String: Any])?["instructions"] as? String, "Serve dirlo?")
        let line = String(decoding: VoiceJudge.logLine(VoiceEvent(kind: .requestDone, at: now, subject: "Timer"),
                                                       VoiceJudge.Verdict(say: true, reason: "Jev: P=0.82, soglia 0.5", p: 0.82), now: now), as: UTF8.self)
        XCTAssertTrue(line.hasSuffix("\n") && line.contains(#""si":true"#) && line.contains(#""tipo":"richiesta_fatta""#))
        XCTAssertFalse(line.contains("sekret"))
    }

    func testWhichKindsAreJudged() {
        for k in [VoiceEvent.Kind.requestDone, .goalReached, .goalBlocked, .endOfTurn] {
            XCTAssertTrue(VoiceJudge.judges(VoiceEvent(kind: k, at: now)), "\(k)")
        }
        for k in [VoiceEvent.Kind.risk, .custom, .question] {
            XCTAssertFalse(VoiceJudge.judges(VoiceEvent(kind: k, at: now)), "\(k) never goes to the judge")
        }
        var done = VoiceEvent(kind: .requestDone, at: now)
        done.judged = true
        XCTAssertFalse(VoiceJudge.judges(done), "giudizio already there")
    }

    func testThreeBlocks() {
        let mine = GoalSources.parseRequest(Data(#"{"id": "Q-1", "testo": "Fixare il timer", "originale": "il timer non si muove", "sessione": "m", "stato": "presa"}"#.utf8))!
        let other = GoalSources.parseRequest(Data(#"{"id": "Q-2", "testo": "Altro", "originale": "colori del logo", "sessione": "z", "stato": "presa"}"#.utf8))!
        let named = GoalSources.parseRequest(Data(#"{"id": "Q-3", "testo": "x", "originale": "chiudi la #1854", "sessione": "z", "stato": "nuova"}"#.utf8))!
        let goal = GoalSources.parseGoal(Data(#"{"cli": "m", "obiettivo": "Timer che scorre", "stato": "aperto", "titolo": "Clotch"}"#.utf8))!
        let e = VoiceEvent(kind: .requestDone, at: now, session: "m", subject: "Timer", text: "Fatto, vedi #1854", proof: "PR #51")
        let s = VoiceJudge.state(e, requests: [mine, other, named], goals: [goal])
        XCTAssertTrue(s["richieste"]!.contains("il timer non si muove"), "Roberto's words, verbatim")
        XCTAssertTrue(s["richieste"]!.contains("Q-3"), "same #N")
        XCTAssertFalse(s["richieste"]!.contains("logo"))
        XCTAssertEqual(s["stato"], "obiettivo (aperto): Timer che scorre")
        XCTAssertEqual(s["segnale"], "richiesta_fatta: Fatto, vedi #1854 (prova: PR #51)")
        XCTAssertEqual(VoiceJudge.state(VoiceEvent(kind: .goalReached, at: now), requests: [], goals: [])["richieste"], "nessuna richiesta collegata")
    }
}
