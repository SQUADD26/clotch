import XCTest
@testable import CodeIslandCore

final class NotchEventsTests: XCTestCase {
    private let t = Date(timeIntervalSince1970: 1_792_588_432)

    private func row(_ id: String, _ status: GoalStatus, done: Int = 0) -> GoalRow {
        GoalRow(id: id, title: id, goal: "g", proofsDone: done, proofsTotal: 3, progress: Double(done) / 3,
                status: status, lastActivity: t, pulses: [])
    }

    private func request(_ id: String, _ state: String) -> UserRequest {
        UserRequest(id: id, at: t, session: "s", sessionTitle: "", text: "x", state: state,
                    takenAt: nil, takenBy: "", doneAt: nil)
    }

    func testGoalChanges() {
        let old = [row("a", .moving, done: 1), row("b", .moving), row("c", .moving), row("d", .still(since: t))]
        let new = [row("a", .moving, done: 2), row("b", .blocked(reason: "r")), row("c", .reached),
                   row("d", .still(since: t.addingTimeInterval(60))), row("e", .moving)]
        XCTAssertEqual(NotchEvents.goals(old: old, new: new).map(\.id),
                       ["proofDone-a-2", "blocked-b-0", "reached-c-0", "opened-e-0"])
        // Still while still is no news; unchanged rows give nothing.
        XCTAssertEqual(NotchEvents.goals(old: new, new: new), [])
    }

    func testRequestTakenOnce() {
        let old = [request("1", "nuova"), request("2", "presa")]
        let new = [request("1", "presa"), request("2", "fatta"), request("3", "nuova")]
        XCTAssertEqual(NotchEvents.requests(old: old, new: new).map(\.id), ["requestTaken-1-0"])
    }
}
