import XCTest
@testable import CodeIslandCore

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
        XCTAssertEqual(NotchEvents.hold(forText: ""), NotchEvents.minHold)
        XCTAssertEqual(NotchEvents.hold(forText: "Barra le richieste"), NotchEvents.minHold, "short text: the minimum")
        let medium = NotchEvents.hold(forText: String(repeating: "a", count: 60))
        XCTAssertGreaterThan(medium, NotchEvents.minHold)
        XCTAssertLessThan(medium, NotchEvents.maxHold)
        XCTAssertGreaterThan(medium, NotchEvents.hold(forText: String(repeating: "a", count: 45)), "longer text: longer")
        XCTAssertEqual(NotchEvents.hold(forText: String(repeating: "a", count: 500)), NotchEvents.maxHold, "capped")
    }

    func testProposedGoalAnnouncesNothing() {
        var still = row("p", .still(since: t), done: 1)
        still.proposed = true
        XCTAssertEqual(NotchEvents.goals(old: [row("p", .moving)], new: [still]), [])
    }

}
