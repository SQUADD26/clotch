import XCTest
@testable import CodeIslandCore

/// #66: a proposed goal is rewritten in place; Invio or «Salva» writes it, Esc leaves it as it was.
final class GoalEditTests: GoalTestCase {
    func testSaveHandsBackTheDraftAndCloses() {
        var edit = GoalEdit()
        XCTAssertFalse(edit.isEditing)
        edit.begin("Scheda in dev")
        XCTAssertTrue(edit.isEditing)
        edit.draft = "Scheda in dev, test verde"
        XCTAssertEqual(edit.save(), "Scheda in dev, test verde")
        XCTAssertFalse(edit.isEditing, "saving closes the field")
        XCTAssertNil(edit.save(), "nothing open, nothing to write")
    }

    func testCancelClosesWithoutText() {
        var edit = GoalEdit()
        edit.begin("Scheda in dev")
        edit.draft = "altro"
        edit.cancel()
        XCTAssertFalse(edit.isEditing)
        XCTAssertNil(edit.save(), "a cancelled edit writes nothing")
    }

    func testSavedProposalRunsConferma() {
        let proposed = rows([g("p", stato: "proposto")], [s("l", cli: "p")])[0]
        var edit = GoalEdit()
        edit.begin(proposed.proposal ?? proposed.goal)
        edit.draft = "Nuovo testo"
        let text = edit.save()!
        XCTAssertEqual(GoalDecision.writeArguments(proposed, text: text, home: "/Users/r"),
                       ["/Users/r/.claude/hooks/obiettivo-guard.py", "conferma", "--sessione", "p", "Nuovo testo"])
    }
}
