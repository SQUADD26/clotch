import XCTest
import SwiftUI
import CodeIslandCore
@testable import CodeIsland

/// Paging logic of the «Obiettivi» tab, and a render of the tab over 2–4 fixture goals.
@MainActor
final class GoalsTabTests: XCTestCase {
    private let now = GoalSources.date("2026-10-21T14:00:00+0000")!

    // MARK: pager

    func testOneStepMovesOnePageAndStopsAtTheEdges() {
        var p = GoalPager(count: 3)
        XCTAssertFalse(p.canBack); XCTAssertTrue(p.canForward)
        XCTAssertFalse(p.step(-1), "first page: back is off")
        XCTAssertEqual(p.page, 0)
        XCTAssertTrue(p.step(1)); XCTAssertEqual(p.page, 1)
        XCTAssertTrue(p.step(5), "a strong step is still one page"); XCTAssertEqual(p.page, 2)
        XCTAssertFalse(p.canForward)
        XCTAssertFalse(p.step(1), "last page: forward is off")
        XCTAssertEqual(p.page, 2)
    }

    func testPageIsClampedWhenGoalsDisappear() {
        XCTAssertEqual(GoalPager(count: 2, page: 7).page, 1)
        XCTAssertEqual(GoalPager(count: 0, page: 3).page, 0)
        var empty = GoalPager(count: 0)
        XCTAssertFalse(empty.step(1)); XCTAssertFalse(empty.step(-1))
    }

    // MARK: swipe

    func testAStrongSwipeStepsOnceEvenWithMomentum() {
        var s = GoalSwipe()
        var steps = 0
        var t: TimeInterval = 100
        // 30 fast events of one gesture, then the fingers lift and 40 momentum events follow.
        for _ in 0..<30 { steps += s.feed(dx: -40, dy: 1, ended: false, momentum: false, precise: true, time: t).step; t += 0.01 }
        _ = s.feed(dx: 0, dy: 0, ended: true, momentum: false, precise: true, time: t)
        for _ in 0..<40 { steps += s.feed(dx: -25, dy: 0, ended: false, momentum: true, precise: true, time: t).step; t += 0.01 }
        XCTAssertEqual(steps, 1)
    }

    func testEachNewGestureStepsAgainAndDirectionFollowsTheFingers() {
        var s = GoalSwipe()
        let left = s.feed(dx: -20, dy: 0, ended: false, momentum: false, precise: true, time: 1)
        XCTAssertEqual(left.step, 1, "fingers left = next page"); XCTAssertTrue(left.consumed)
        _ = s.feed(dx: 0, dy: 0, ended: true, momentum: false, precise: true, time: 1.1)
        XCTAssertEqual(s.feed(dx: 20, dy: 0, ended: false, momentum: false, precise: true, time: 2).step, -1)
    }

    func testSmallAndVerticalMovesDoNotStep() {
        var s = GoalSwipe()
        XCTAssertEqual(s.feed(dx: -5, dy: 0, ended: false, momentum: false, precise: true, time: 1).step, 0)
        XCTAssertEqual(s.feed(dx: -4, dy: 0, ended: false, momentum: false, precise: true, time: 1.01).step, 0)
        let vertical = s.feed(dx: -30, dy: 80, ended: false, momentum: false, precise: true, time: 1.02)
        XCTAssertEqual(vertical.step, 0); XCTAssertFalse(vertical.consumed, "vertical scroll is left alone")
        XCTAssertEqual(s.feed(dx: -6, dy: 0, ended: false, momentum: false, precise: true, time: 1.03).step, 1, "5+4+6 passes the threshold")
    }

    func testMouseWheelStepsOncePerCooldown() {
        var s = GoalSwipe()
        let steps = [0.0, 0.05, 0.1, 0.4, 0.45].map { s.feed(dx: -3, dy: 0, ended: false, momentum: false, precise: false, time: $0).step }
        XCTAssertEqual(steps, [1, 0, 0, 1, 0])
    }

    // MARK: render

    private func rows(_ n: Int) -> [GoalRow] {
        let goals = (0..<n).map { i -> GoalRecord in
            let done = i % 4 == 3 ? "[]" : #"[{"testo":"a","fatta":true,"t":"2026-10-21T11:00:00+0000"},{"testo":"b","fatta":\#(i % 2 == 0)},{"testo":"c","fatta":false}]"#
            let stato = i == 2 ? "bloccato" : "aperto"
            return GoalSources.parseGoal(Data(#"""
            {"cli":"cli-\#(i)","obiettivo":"Obiettivo di prova numero \#(i)","stato":"\#(stato)","prova":"BLOCCATO: serve una chiave",
             "t":"2026-10-21T13:50:00+0000","titolo":"Goal \#(i)","prove":\#(done)}
            """#.utf8))!
        }
        let sessions = (0..<n).map { i in
            GoalSources.parseSession(Data(#"{"sessionId":"local_m\#(i)","cliSessionId":"cli-\#(i)","title":"m","isRunning":\#(i != 1),"isArchived":false,"lastActivityAt":\#(Int(now.timeIntervalSince1970 * 1000) - 60_000)}"#.utf8),
                                     fileName: "local_m\(i).json")!
        }
        return GoalBoard.rows(goals: goals, sessions: sessions, live: [], now: now)
    }

    func testOrderPutsTheGoalChasedNowFirst() {
        let r = rows(4)
        let ordered = GoalPager.ordered(r)
        XCTAssertEqual(ordered.count, 4)
        XCTAssertEqual(ordered.first?.id, r.hero?.id)
        XCTAssertEqual(Set(ordered.map(\.id)), Set(r.map(\.id)))
    }

    func testTabRendersForTwoThreeAndFourGoals() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("goals-tab-snapshots")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        for n in 2...4 {
            let view = GoalsTabView(rows: rows(n)) { _ in Color.clear.frame(height: 40) }
                .frame(width: 560)
                .environment(\.colorScheme, .dark).environment(\.notchSnapshot, true)
            let renderer = ImageRenderer(content: view)
            renderer.scale = 2
            let image = try XCTUnwrap(renderer.cgImage, "\(n) goals did not render")
            let png = try XCTUnwrap(NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]))
            let url = dir.appendingPathComponent("goals-tab-\(n).png")
            try png.write(to: url)
            print("goals-tab snapshot: \(url.path)")
        }
    }

    func testWorkTimeFormat() {
        XCTAssertEqual(WorkTime.format(7457), "2:04:17")
        XCTAssertEqual(WorkTime.format(-5), "0:00:00")
        XCTAssertEqual(WorkTime.format(59), "0:00:59")
    }
}
