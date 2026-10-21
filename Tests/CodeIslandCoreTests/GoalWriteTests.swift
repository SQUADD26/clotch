import XCTest
@testable import CodeIslandCore

/// #36: Roberto writes the goal from the notch, and arrivals never move the page he is reading.
final class GoalWriteTests: GoalTestCase {
    func testWriteRunsConfermaWithTheText() {
        let row = rows([g("cli-1")], [s("l", cli: "cli-1")])[0]
        XCTAssertEqual(GoalDecision.writeArguments(row, text: "  Scheda  nuova\nin dev, test verde ", home: "/Users/r"),
                       ["/Users/r/.claude/hooks/obiettivo-guard.py", "conferma", "--sessione", "cli-1", "Scheda nuova in dev, test verde"])
        XCTAssertNil(GoalDecision.writeArguments(row, text: "   ", home: "/Users/r"), "an empty text writes nothing")
        XCTAssertNil(GoalDecision.writeArguments(row, text: row.goal, home: "/Users/r"), "the same fixed goal writes nothing")
        let proposed = rows([g("p", stato: "proposto")], [s("l", cli: "p")])[0]
        XCTAssertEqual(GoalDecision.writeArguments(proposed, text: proposed.goal, home: "/Users/r")?.last, proposed.goal,
                       "the proposed text as it is: Roberto fixes it")
    }

    func testThreeArrivalsKeepTheOpenPage() {
        let before = rows([g("a"), g("b")], [s("la", cli: "a"), s("lb", cli: "b")])
        let order = GoalBoard.keepOrder([], GoalBoard.tab(before).goals.map(\.id))
        let open = order[1], at = 1
        // Three new goals, two blocked: GoalBoard puts those first.
        let after = rows([g("a"), g("b"), g("n1", stato: "bloccato", prova: "x"), g("n2"), g("n3", stato: "bloccato", prova: "y")],
                         ["a", "b", "n1", "n2", "n3"].map { s("l" + $0, cli: $0) })
        let fresh = GoalBoard.tab(after).goals.map(\.id)
        XCTAssertNotEqual(fresh.firstIndex(of: open), at, "without keepOrder the open page would move")
        let next = GoalBoard.keepOrder(order, fresh)
        XCTAssertEqual(next.firstIndex(of: open), at, "the open goal stays on its page")
        XCTAssertEqual(Array(next.prefix(2)), order, "what was shown keeps its order")
        XCTAssertEqual(Set(next.dropFirst(2)), ["n1", "n2", "n3"], "the new ones go at the end")
        XCTAssertEqual(GoalBoard.keepOrder(next, fresh.filter { $0 != "a" }), Array(next.dropFirst()), "a closed goal leaves")
    }
}
