import AppKit
import SwiftUI
import XCTest
@testable import Clotch
@testable import ClotchCore

/// The open notch is as tall as the tab it shows, not as tall as the room it is offered (#17).
@MainActor
final class NotchHeightTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_792_590_000)

    /// The height `view` takes when 560 × 800 pt are offered, as the panel offers its room.
    private func height<V: View>(_ view: V) -> CGFloat {
        NSHostingController(rootView: view).sizeThatFits(in: CGSize(width: 560, height: 800)).height
    }

    private func row(_ id: String) -> GoalRow {
        GoalRow(id: id, title: "Notch: goal \(id)", goal: "g", proofsDone: 1, proofsTotal: 3, progress: 1.0 / 3,
                status: .moving, lastActivity: now, pulses: [])
    }

    func testHuggingTakesTheContentsHeightUpToTheCap() {
        XCTAssertEqual(height(Color.clear.frame(height: 40).hugging(maxHeight: 600)), 40, accuracy: 0.5)
        XCTAssertEqual(height(Color.clear.frame(height: 900).hugging(maxHeight: 600)), 600, accuracy: 0.5)
    }

    func testGoalsTabIsShorterWithOneGoalThanWithAList() {
        let one = height(GoalsTab(rows: [row("a")], now: now).hugging(maxHeight: 700))
        let many = height(GoalsTab(rows: [row("a"), row("b"), row("c")], now: now).hugging(maxHeight: 700))
        XCTAssertLessThanOrEqual(one, many)  // no page dots any more (#140): a list is never shorter
        XCTAssertLessThan(one, 700)   // and nothing fills the cap
    }

    func testEmptyGoalsTabIsShorterThanAGoal() {
        XCTAssertLessThan(height(GoalsTab(rows: [], now: now).hugging(maxHeight: 700)),
                          height(GoalsTab(rows: [row("a")], now: now).hugging(maxHeight: 700)))
    }
}
