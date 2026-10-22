import XCTest
@testable import ClotchCore

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

    func testWheelBurstOf10In100msStepsOnce() {
        var s = PageSwipe()
        var steps: [Int] = []
        for i in 0..<10 { if let x = s.feed(dx: -3, phase: .wheel, at: t0.addingTimeInterval(Double(i) * 0.01)) { steps.append(x) } }
        XCTAssertEqual(steps, [1])
    }

    func testLongFastSpinStepsOnceThenPauseStepsAgain() {
        var s = PageSwipe()
        var steps: [Int] = []
        for i in 0..<40 { if let x = s.feed(dx: 2, phase: .wheel, at: t0.addingTimeInterval(Double(i) * 0.05)) { steps.append(x) } }
        XCTAssertEqual(steps, [-1])  // 2 s of spin, one gesture
        XCTAssertEqual(s.feed(dx: 2, phase: .wheel, at: t0.addingTimeInterval(1.95 + PageSwipe.wheelGap + 0.05)), -1)
    }

    func testTrackpadBurstStepsOnceEachWay() {
        var s = PageSwipe()
        var steps: [Int] = []
        _ = s.feed(dx: -1, phase: .began, at: t0)
        for _ in 0..<10 { if let x = s.feed(dx: -200, phase: .changed, at: t0) { steps.append(x) } }
        _ = s.feed(dx: 3, phase: .began, at: t0)
        for _ in 0..<10 { if let x = s.feed(dx: 200, phase: .changed, at: t0) { steps.append(x) } }
        XCTAssertEqual(steps, [1, -1])  // fingers left = next, right = previous
    }

    func testTargetStopsAtTheEdges() {
        XCTAssertEqual(PageSwipe.target(from: 0, step: 1, count: 3), 1)
        XCTAssertEqual(PageSwipe.target(from: 2, step: -1, count: 3), 1)
        XCTAssertNil(PageSwipe.target(from: 2, step: 1, count: 3))
        XCTAssertNil(PageSwipe.target(from: 0, step: -1, count: 3))
    }

    /// The symptom of #119 on the Goals tab: a pager that keeps the page count it had when it appeared
    /// (here 2) stops at the second page, however many goals have arrived since (here 5).
    func testOldCountStopsTheNextPageNewCountDoesNot() {
        XCTAssertNil(PageSwipe.target(from: 1, step: 1, count: 2))
        XCTAssertEqual(PageSwipe.target(from: 1, step: 1, count: 5), 2)
        XCTAssertEqual(PageDrag.settle(index: 1, offset: -300, velocity: -800, width: 440, count: 2), 1)
        XCTAssertEqual(PageDrag.settle(index: 1, offset: -300, velocity: -800, width: 440, count: 5), 2)
    }
}

final class PageDragTests: XCTestCase {
    private let t0 = Date(timeIntervalSince1970: 1_000)
    private let w = 460.0

    /// Feeds `steps` equal events of `dx` points, `dt` seconds apart; returns the drag and the last event time.
    private func drag(_ dx: Double, steps: Int, dt: Double) -> (PageDrag, Date) {
        var d = PageDrag()
        var t = t0
        for _ in 0..<steps { t = t.addingTimeInterval(dt); d.move(dx: dx, at: t) }
        return (d, t)
    }

    func testFollowsTheFingersOneToOneInside() {
        XCTAssertEqual(PageDrag.offset(travel: -120, index: 1, count: 3, width: w), -120)
        XCTAssertEqual(PageDrag.offset(travel: 80, index: 1, count: 3, width: w), 80)
        XCTAssertEqual(PageDrag.offset(travel: -900, index: 1, count: 3, width: w), -w)  // one page at most
    }

    func testRubberBandsPastTheEdges() {
        let first = PageDrag.offset(travel: 200, index: 0, count: 3, width: w)
        let last = PageDrag.offset(travel: -200, index: 2, count: 3, width: w)
        XCTAssertGreaterThan(first, 0); XCTAssertLessThan(first, 100)
        XCTAssertEqual(last, -first, accuracy: 0.001)
        XCTAssertLessThan(PageDrag.offset(travel: 5_000, index: 0, count: 3, width: w), w)
        XCTAssertLessThan(abs(PageDrag.offset(travel: 60, index: 0, count: 1, width: w)), 60)  // one page: both edges
    }

    func testShortSlowGestureStays() {
        let (d, end) = drag(-4, steps: 10, dt: 0.016)  // 40 pt at 250 pt/s
        let v = d.releaseVelocity(at: end.addingTimeInterval(0.01))
        XCTAssertEqual(PageDrag.settle(index: 1, offset: d.travel, velocity: v, width: w, count: 3), 1)
    }

    func testShortFastGestureMoves() {
        let (d, end) = drag(-20, steps: 3, dt: 0.016)  // 60 pt at 1250 pt/s
        let v = d.releaseVelocity(at: end.addingTimeInterval(0.01))
        XCTAssertEqual(v, -1250, accuracy: 1)
        XCTAssertEqual(PageDrag.settle(index: 1, offset: d.travel, velocity: v, width: w, count: 3), 2)
        let (back, endBack) = drag(20, steps: 3, dt: 0.016)
        XCTAssertEqual(PageDrag.settle(index: 1, offset: back.travel, velocity: back.releaseVelocity(at: endBack), width: w, count: 3), 0)
    }

    func testFlickThenRestBeforeLiftingCarriesNoSpeed() {
        let (d, end) = drag(-20, steps: 3, dt: 0.016)
        let v = d.releaseVelocity(at: end.addingTimeInterval(0.3))
        XCTAssertEqual(v, 0)
        XCTAssertEqual(PageDrag.settle(index: 1, offset: d.travel, velocity: v, width: w, count: 3), 1)
    }

    func testLongSlowDragPastHalfMoves() {
        XCTAssertEqual(PageDrag.settle(index: 1, offset: -240, velocity: 0, width: w, count: 3), 2)
        XCTAssertEqual(PageDrag.settle(index: 1, offset: -220, velocity: 0, width: w, count: 3), 1)
    }

    func testFlickAgainstTheDragGoesBack() {
        XCTAssertEqual(PageDrag.settle(index: 1, offset: -300, velocity: 800, width: w, count: 3), 1)
    }

    func testEdgesHoldAndOnePageAtMost() {
        XCTAssertEqual(PageDrag.settle(index: 0, offset: 100, velocity: 3_000, width: w, count: 3), 0)
        XCTAssertEqual(PageDrag.settle(index: 2, offset: -100, velocity: -3_000, width: w, count: 3), 2)
        XCTAssertEqual(PageDrag.settle(index: 0, offset: -w, velocity: -10_000, width: w, count: 5), 1)
        XCTAssertEqual(PageDrag.settle(index: 0, offset: -300, velocity: 0, width: 0, count: 3), 0)  // not laid out yet
    }
}

final class PageSpringTests: XCTestCase {
    func testCarriesOnlySpeedTowardThePageCapped() {
        XCTAssertEqual(PageDrag.springVelocity(-800, travel: -400), 2)
        XCTAssertEqual(PageDrag.springVelocity(800, travel: -400), 0)  // flick away: the spring starts still
        XCTAssertEqual(PageDrag.springVelocity(3_000, travel: 20), 12)
        XCTAssertEqual(PageDrag.springVelocity(500, travel: 0), 0)
    }
}

final class PageSpringHandoverTests: XCTestCase {
    private let t0 = Date(timeIntervalSince1970: 1_000)

    private func run(_ s: inout PageSpring, _ seconds: Double) {
        for _ in 0..<Int(seconds * 120) { s.advance(by: 1.0 / 120) }
    }

    func testSettlesOnTheRestPlace() {
        var s = PageSpring(offset: 440, velocity: 0)
        run(&s, 1.5)
        XCTAssertTrue(s.isAtRest)
    }

    func testStartSpeedIsKept() {
        var still = PageSpring(offset: 440), fast = PageSpring(offset: 440, velocity: -3_000)
        run(&still, 0.05); run(&fast, 0.05)
        XCTAssertLessThan(fast.offset, still.offset - 50)
    }

    func testGestureDuringTheSpringTakesItWhereItIs() {
        var s = PageSpring(offset: 440)  // a page turn just began: the pages are one pitch behind
        run(&s, 0.1)
        XCTAssertGreaterThan(s.offset, 50)  // still on its way
        // The fingers land: the drag starts from the pages' real place, so nothing jumps.
        var d = PageDrag(travel: s.offset)
        XCTAssertEqual(PageDrag.offset(travel: d.travel, index: 1, count: 3, width: 440), s.offset, accuracy: 0.001)
        d.move(dx: -10, at: t0)
        XCTAssertEqual(PageDrag.offset(travel: d.travel, index: 1, count: 3, width: 440), s.offset - 10, accuracy: 0.001)
    }

    func testTwoQuickGesturesMakeTwoPages() {
        let pitch = 440.0
        var index = 0
        // First flick: lets go with speed, the page turn starts at once.
        var first = PageDrag(), t = t0
        for _ in 0..<5 { t += 0.016; first.move(dx: -40, at: t) }
        let target1 = PageDrag.settle(index: index, offset: first.travel, velocity: first.releaseVelocity(at: t), width: pitch, count: 3)
        XCTAssertEqual(target1, 1)
        var s = PageSpring(offset: first.travel + Double(index - target1) * pitch, velocity: first.releaseVelocity(at: t))
        index = target1
        // 0.1 s later, still moving: a second flick takes the pages and turns once more.
        run(&s, 0.1)
        XCTAssertFalse(s.isAtRest)
        var second = PageDrag(travel: s.offset)
        for _ in 0..<5 { t += 0.016; second.move(dx: -40, at: t) }
        let offset = PageDrag.offset(travel: second.travel, index: index, count: 3, width: pitch)
        let target2 = PageDrag.settle(index: index, offset: offset, velocity: second.releaseVelocity(at: t), width: pitch, count: 3)
        XCTAssertEqual(target2, 2)
        s = PageSpring(offset: offset + Double(index - target2) * pitch, velocity: second.releaseVelocity(at: t))
        run(&s, 1.5)
        XCTAssertTrue(s.isAtRest)
    }

    func testWheelTwoSpinsCloseTogetherMakeTwoSteps() {
        var s = PageSwipe()
        XCTAssertEqual(s.feed(dx: -1, phase: .wheel, at: t0), 1)
        XCTAssertNil(s.feed(dx: -1, phase: .wheel, at: t0.addingTimeInterval(0.1)))  // same spin
        XCTAssertEqual(s.feed(dx: -1, phase: .wheel, at: t0.addingTimeInterval(0.1 + PageSwipe.wheelGap + 0.01)), 1)
        XCTAssertEqual(s.feed(dx: 1, phase: .wheel, at: t0.addingTimeInterval(0.8)), -1)
        XCTAssertEqual(s.feed(dx: -1, phase: .wheel, at: t0.addingTimeInterval(0.82)), 1)  // turned back at once
    }
}
