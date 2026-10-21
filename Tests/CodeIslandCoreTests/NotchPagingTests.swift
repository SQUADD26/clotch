import XCTest
@testable import CodeIslandCore

final class NotchPagingTests: XCTestCase {
    private let t0 = Date(timeIntervalSince1970: 1_000)

    func testStrongSwipeStepsOnce() {
        var s = PageSwipe()
        var steps: [Int] = []
        if let x = s.feed(dx: -10, phase: .began, at: t0) { steps.append(x) }
        for _ in 0..<40 { if let x = s.feed(dx: -60, phase: .changed, at: t0) { steps.append(x) } }
        if let x = s.feed(dx: 0, phase: .ended, at: t0) { steps.append(x) }
        for _ in 0..<30 { if let x = s.feed(dx: -80, phase: .momentum, at: t0) { steps.append(x) } }
        XCTAssertEqual(steps, [1])
    }

    func testSmallSwipeDoesNotStep() {
        var s = PageSwipe()
        XCTAssertNil(s.feed(dx: 5, phase: .began, at: t0))
        XCTAssertNil(s.feed(dx: 10, phase: .changed, at: t0))
    }

    func testRightSwipeGoesBackAndNextGestureStepsAgain() {
        var s = PageSwipe()
        _ = s.feed(dx: 10, phase: .began, at: t0)
        XCTAssertEqual(s.feed(dx: 20, phase: .changed, at: t0), -1)
        XCTAssertNil(s.feed(dx: 50, phase: .changed, at: t0))
        _ = s.feed(dx: -5, phase: .began, at: t0)
        XCTAssertEqual(s.feed(dx: -30, phase: .changed, at: t0), 1)
    }

    func testWheelStepsOncePerGap() {
        var s = PageSwipe()
        XCTAssertEqual(s.feed(dx: -1, phase: .wheel, at: t0), 1)
        XCTAssertNil(s.feed(dx: -1, phase: .wheel, at: t0.addingTimeInterval(0.1)))
        XCTAssertEqual(s.feed(dx: 1, phase: .wheel, at: t0.addingTimeInterval(0.5)), -1)
    }
}
