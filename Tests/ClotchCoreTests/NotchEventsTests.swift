import XCTest
@testable import ClotchCore

final class NotchEventsTests: XCTestCase {
    private let t = Date(timeIntervalSince1970: 1_792_588_432)

    private func row(_ id: String, _ status: GoalStatus, done: Int = 0) -> GoalRow {
        GoalRow(id: id, title: id, goal: "g", proofsDone: done, proofsTotal: 3, progress: Double(done) / 3,
                status: status, lastActivity: t, pulses: [])
    }


    func testGoalChanges() {
        let old = [row("a", .moving, done: 1), row("b", .moving), row("c", .moving), row("d", .still(since: t))]
        let new = [row("a", .moving, done: 2), row("b", .blocked(reason: "r")), row("c", .reached),
                   row("d", .still(since: t.addingTimeInterval(60))), row("e", .moving)]
        XCTAssertEqual(NotchEvents.goals(old: old, new: new).map(\.id),
                       ["proofDone-a-2", "blocked-b-0", "reached-c-0"], "a new goal (e) is not news")
        // Still while still is no news; unchanged rows give nothing.
        XCTAssertEqual(NotchEvents.goals(old: new, new: new), [])
    }

    func testHoldGrowsWithTextWithinBounds() {
        XCTAssertEqual(NotchEvents.hold(forText: ""), NotchEvents.minHold + 3, "#39: 3 s more than before")
        XCTAssertEqual(NotchEvents.hold(forText: "Barra le richieste"), NotchEvents.minHold + 3, "short text: the minimum")
        let medium = NotchEvents.hold(forText: String(repeating: "a", count: 60))
        XCTAssertGreaterThan(medium, NotchEvents.minHold + 3)
        XCTAssertLessThan(medium, NotchEvents.maxHold + 3)
        XCTAssertGreaterThan(medium, NotchEvents.hold(forText: String(repeating: "a", count: 45)), "longer text: longer")
        XCTAssertEqual(NotchEvents.hold(forText: String(repeating: "a", count: 500)), NotchEvents.maxHold + 3, "capped")
    }

    func testThreeLineNoteGetsItsReadingTime() {
        // #102: the line wraps up to three lines, never more, and a third line still adds reading time.
        XCTAssertEqual(NotchEvents.noteLines, 3)
        let twoLines = NotchEvents.hold(forText: String(repeating: "a", count: 74))
        let threeLines = NotchEvents.hold(forText: String(repeating: "a", count: 110))
        XCTAssertGreaterThan(twoLines, NotchEvents.hold(forText: String(repeating: "a", count: 37)), "two lines: longer than one")
        XCTAssertGreaterThan(threeLines, twoLines, "three lines: longer than two")
        XCTAssertEqual(NotchEvents.hold(forText: String(repeating: "a", count: 300)), threeLines, "past three lines: the cap")
    }

    func testProposedGoalAnnouncesNothing() {
        var still = row("p", .still(since: t), done: 1)
        still.proposed = true
        XCTAssertEqual(NotchEvents.goals(old: [row("p", .moving)], new: [still]), [])
    }

    func testConfirmedGoalIsNews() {
        var proposed = row("p", .moving)
        proposed.proposed = true
        XCTAssertEqual(NotchEvents.goals(old: [proposed], new: [row("p", .moving)]).map(\.id), ["confirmed-p-0"])
    }

    func testNoticeSaysWhatAndWho() {
        XCTAssertEqual(NotchEvents.notice(.requestTaken, title: "Correggere notch tra schermi", by: "Clotch"),
                       "Presa in carico: Correggere notch tra schermi · Clotch")
        XCTAssertEqual(NotchEvents.notice(.requestTaken, title: "Correggere notch"), "Presa in carico: Correggere notch")
        XCTAssertEqual(NotchEvents.notice(.requestTaken, title: "Correggere notch", done: true), "Fatta: Correggere notch")
        XCTAssertEqual(NotchEvents.notice(.confirmed, title: "Notch"), "Obiettivo confermato: Notch")
        XCTAssertEqual(NotchEvents.notice(.reached, title: "Notch"), "Obiettivo raggiunto: Notch")
        XCTAssertNil(NotchEvents.notice(.proofDone, title: "Notch"), "other events keep only their line")
        let long = NotchEvents.notice(.requestTaken, title: String(repeating: "a", count: 80), by: String(repeating: "s", count: 40))!
        XCTAssertEqual(long, "Presa in carico: " + String(repeating: "a", count: 39) + "… · " + String(repeating: "s", count: 23) + "…",
                       "long title and session are clipped with …, the session stays")
    }

    /// #111: six proofs in a row while the notch is busy read «6 su 6» six times; they must be one notice.
    func testProofsWaitingInTheQueueBecomeOneNotice() {
        var queue: [NotchEvent] = []
        for n in 1...10 { queue = NotchEvents.merge(queue: queue, adding: [NotchEvent(kind: .proofDone, subject: "a", count: n)]) }
        queue = NotchEvents.merge(queue: queue, adding: [NotchEvent(kind: .blocked, subject: "a", count: 0)])
        XCTAssertEqual(queue.map(\.id), ["proofDone-a-10", "blocked-a-0"])
    }
}
