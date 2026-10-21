import AppKit
import SwiftUI
import XCTest
@testable import CodeIsland
import CodeIslandCore

/// The PR rows under a goal, drawn from fixtures (one PR per state). Set GOALNOTCH_SNAPSHOT_DIR to keep the PNG.
@MainActor
final class GoalPRRowTests: XCTestCase {
    func testEveryStateHasItsOwnLookAndWords() {
        let states: [PRState] = [.pending, .green, .red, .conflict, .merged]
        XCTAssertEqual(states.map { PRLook($0).label }, ["In corso", "Verde", "Rosso", "Conflitto", "Unita"])
        XCTAssertEqual(Set(states.map { "\(PRLook($0).color)" }).count, 5, "five states, five colours")
        XCTAssertTrue(PRLook(.conflict).conflict)
        XCTAssertFalse(PRLook(.red).conflict)
    }

    func testListDrawsFixturesAndStaysEmptyWithoutPRs() throws {
        func render<V: View>(_ view: V) -> NSBitmapImageRep? {
            OffscreenRender.rasterize(view.padding(24).frame(width: 520).background(Color.black).environment(\.colorScheme, .dark))
                .map { NSBitmapImageRep(cgImage: $0) }
        }
        let full = try XCTUnwrap(render(GoalPRList(open: GoalPRFixtures.open, merged: GoalPRFixtures.merged)))
        XCTAssertEqual(full.pixelsWide, 1040)
        let none = try XCTUnwrap(render(GoalPRList(open: [], merged: [])))
        XCTAssertGreaterThan(full.pixelsHigh, none.pixelsHigh + 5 * 40, "header + five rows; nothing at all without PRs")
        if let dir = ProcessInfo.processInfo.environment["GOALNOTCH_SNAPSHOT_DIR"], let png = full.representation(using: .png, properties: [:]) {
            try png.write(to: URL(fileURLWithPath: dir).appendingPathComponent("goal-pr-rows.png"))
        }
    }
}
