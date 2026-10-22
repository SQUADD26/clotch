import XCTest
@testable import ClotchCore

/// #20: proposed goals apart from confirmed ones, Accetta runs the register's `conferma`, closed sessions out of the list.
final class GoalProposalsTests: GoalTestCase {
    private func withProposal(_ cli: String) -> GoalRecord {
        var data = String(decoding: goalJSON(cli), as: UTF8.self)
        data = data.replacingOccurrences(of: #""visto": "ab12cd34ef""#,
                                         with: #""visto": "ab12cd34ef", "proposta": {"testo": "Nuovo obiettivo proposto", "t": "2026-10-21T13:00:00+0000"}"#)
        return GoalSources.parseGoal(Data(data.utf8))!
    }

    func testProposedApartFromConfirmed() {
        let goals = [g("aperto"), g("proposto", stato: "proposto"), withProposal("accanto")]
        let tab = GoalBoard.tab(rows(goals, [s("l1", cli: "aperto"), s("l2", cli: "proposto"), s("l3", cli: "accanto")]))
        XCTAssertEqual(Set(tab.goals.map(\.id)), ["aperto", "accanto"], "a proposed goal is never among the confirmed ones")
        XCTAssertEqual(Set(tab.toConfirm.map(\.id)), ["proposto", "accanto"])
        XCTAssertEqual(tab.toConfirm.first { $0.id == "proposto" }?.proposal, "Fare il dato vivo")
        XCTAssertEqual(tab.toConfirm.first { $0.id == "accanto" }?.proposal, "Nuovo obiettivo proposto")
        XCTAssertNil(tab.goals.first { $0.id == "aperto" }?.proposal)
    }

    /// #171 (A-F-10): what is hidden comes from the register alone. The engine drops a rejected proposal («rifiutato» is never
    /// shown), so a proposal still in the file shows, even if the same text was refused before.
    func testProposalShowsWhileTheRegisterHoldsIt_RejectedStateNeverShows() {
        let held = rows([g("p", stato: "proposto")], [s("l1", cli: "p")])
        XCTAssertEqual(GoalBoard.tab(held).toConfirm.map(\.id), ["p"], "the same text again after a refusal shows again")
        let refused = rows([g("p", stato: "rifiutato")], [s("l1", cli: "p")])
        XCTAssertEqual(GoalBoard.tab(refused).toConfirm, [])
    }

    func testProofOnlyRobertoCanTickIsMarked() {
        let json = #"{"cli":"c","obiettivo":"g","stato":"aperto","prove":[{"testo":"a","fatta":false,"cmd":"x => 1"},{"testo":"la pagina sembra giusta","fatta":false,"cmd":""},{"testo":"b","fatta":true}]}"#
        XCTAssertEqual(GoalSources.parseGoal(Data(json.utf8))?.proofs?.map(\.waitsForRoberto), [false, true, false], "no command and not done = Roberto's")
    }

    func testAcceptAndRejectRunTheGuardWithTheRowCli() {
        let row = rows([g("cli-123", stato: "proposto")], [s("local_x", cli: "cli-123")])[0]
        XCTAssertEqual(GoalDecision.acceptArguments(row, home: "/Users/r"),
                       ["/Users/r/.claude/hooks/obiettivo-guard.py", "conferma", "--sessione", "cli-123"], "the cli id, not the app's local id")
        XCTAssertEqual(GoalDecision.rejectArguments(row, home: "/Users/r"),
                       ["/Users/r/.claude/hooks/obiettivo-guard.py", "rifiuta", "--sessione", "cli-123"])
        let confirmed = rows([g("a")], [s("l", cli: "a")])[0]
        XCTAssertNil(GoalDecision.acceptArguments(confirmed, home: "/Users/r"), "nothing to accept on a confirmed goal")
        XCTAssertNil(GoalDecision.rejectArguments(confirmed, home: "/Users/r"))
    }

    func testRejectedAndPastNeverShown() {
        let states = ["rifiutato", "passato", "proposto"]
        XCTAssertEqual(rows(states.map { g($0, stato: $0) }, states.map { s("l\($0)", cli: $0) }).map(\.id), ["proposto"])
    }

    /// «Friday fermo da 2 h»: its session data is old, but the hook wrote `ultima_attivita` a minute ago.
    func testStillComesFromUltimaAttivita() {
        func record(_ extra: String) -> GoalRecord {
            let json = String(decoding: goalJSON("o"), as: UTF8.self)
                .replacingOccurrences(of: #""visto": "ab12cd34ef""#, with: #""visto": "ab12cd34ef""# + extra)
            return GoalSources.parseGoal(Data(json.utf8))!
        }
        let old = [s("l", cli: "o", ago: 120)]
        guard case .moving = rows([record(#", "ultima_attivita": "\#(local(1))""#)], old)[0].status else { return XCTFail("expected moving") }
        guard case .still(let since) = rows([record("")], old)[0].status else { return XCTFail("expected still") }
        XCTAssertEqual(since, minutesAgo(120), "without ultima_attivita the old signs still count")
        XCTAssertEqual(GoalBoard.nextChange(goals: [record(#", "ultima_attivita": "\#(local(1))""#)], sessions: old, live: [], now: now),
                       minutesAgo(1).addingTimeInterval(GoalBoard.stillAfter), "the board turns it still 30 min after the last sign")
    }

    func testClosedSessionsLastAndOutOfTheList() {
        let goals = [g("archiviata", stato: "bloccato", prova: "x"), g("sparita"), g("viva"), g("proposta-vecchia", stato: "proposto")]
        let sessions = [s("l1", cli: "archiviata", archived: true), s("l2", cli: "viva"), s("l3", cli: "proposta-vecchia", archived: true)]
        let all = rows(goals, sessions)
        XCTAssertEqual(all.first?.id, "viva", "a blocked goal of an archived session no longer tops the list")
        XCTAssertEqual(Set(all.filter(\.closed).map(\.id)), ["archiviata", "sparita", "proposta-vecchia"])
        let tab = GoalBoard.tab(all)
        XCTAssertEqual(tab.goals.map(\.id), ["viva"])
        XCTAssertEqual(tab.toConfirm, [], "a proposal of an archived session is not asked")
        XCTAssertEqual(tab.closed, 3)
        XCTAssertEqual(GoalBoard.chased(all)?.id, "viva")
        XCTAssertNil(GoalBoard.chased(rows([g("sparita")])), "only closed goals: nothing is chased")
    }
}
