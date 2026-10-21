import XCTest
@testable import CodeIslandCore

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

    func testRejectedProposalHiddenUntilNewText() {
        let r = rows([g("p", stato: "proposto")], [s("l1", cli: "p")])
        XCTAssertEqual(GoalBoard.tab(r, rejected: [GoalDecision.key(cli: "p", text: "Fare il dato vivo")]).toConfirm, [])
        XCTAssertEqual(GoalBoard.tab(r, rejected: [GoalDecision.key(cli: "p", text: "un altro testo")]).toConfirm.map(\.id), ["p"])
    }

    func testAcceptRunsConfermaWithTheRowCliAndText() {
        let row = rows([g("cli-123", stato: "proposto")], [s("local_x", cli: "cli-123")])[0]
        let args = GoalDecision.acceptArguments(row)!
        XCTAssertEqual(args[0], "-c")
        XCTAssertTrue(args[1].contains("obiettivo_registro") && args[1].contains("r.conferma(sys.argv[1], sys.argv[2])"))
        XCTAssertEqual(Array(args.dropFirst(2)), ["cli-123", "Fare il dato vivo"], "the cli id, not the app's local id")
        XCTAssertNil(GoalDecision.acceptArguments(rows([g("a")], [s("l", cli: "a")])[0]), "nothing to accept on a confirmed goal")
    }

    func testRejectRunsRifiutaWithTheRowCli() {
        let row = rows([g("cli-123", stato: "proposto")], [s("local_x", cli: "cli-123")])[0]
        XCTAssertEqual(GoalDecision.rejectArguments(row, home: "/Users/r"),
                       ["/Users/r/.claude/hooks/obiettivo-guard.py", "rifiuta", "--sessione", "cli-123"])
        XCTAssertNil(GoalDecision.rejectArguments(rows([g("a")], [s("l", cli: "a")])[0], home: "/Users/r"))
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
