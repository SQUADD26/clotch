import XCTest
@testable import ClotchCore

/// #117: the notch opened by itself and took the keyboard. A hover-enter counts only when the pointer moved.
final class NotchFocusTests: XCTestCase {
    func testIslandGrowingUnderAStillPointerIsNotAHover() {
        // A notification drops under the closed notch where the pointer rests since 3 s.
        XCTAssertFalse(NotchFocus.isUserHover(secondsSincePointerMoved: 3))
        XCTAssertFalse(NotchFocus.isUserHover(secondsSincePointerMoved: NotchFocus.pointerMoveWindow))
    }

    func testPointerMovingOntoTheIslandIsAHover() {
        XCTAssertTrue(NotchFocus.isUserHover(secondsSincePointerMoved: 0))
        XCTAssertTrue(NotchFocus.isUserHover(secondsSincePointerMoved: 0.1))
    }

    func testNoInputDataIsNotAHover() {
        XCTAssertFalse(NotchFocus.isUserHover(secondsSincePointerMoved: .nan))
        XCTAssertFalse(NotchFocus.isUserHover(secondsSincePointerMoved: -1))
    }
}

final class NotchHoverGateTests: XCTestCase {
    private let rest = CGPoint(x: 700, y: 880)

    func testStillEntryWaitsThenARealMoveInsideOpens() {
        var gate = NotchHoverGate()
        XCTAssertFalse(gate.enter(at: rest, secondsSincePointerMoved: 3))  // an alert grew the island under the pointer
        XCTAssertFalse(gate.move(to: rest))                                // a layout pass, the pointer did not move
        XCTAssertTrue(gate.move(to: CGPoint(x: 703, y: 880)))              // Roberto nudges the mouse: it opens
        XCTAssertFalse(gate.move(to: CGPoint(x: 710, y: 880)))             // once
    }

    func testMovingEntryOpensAtOnce() {
        var gate = NotchHoverGate()
        XCTAssertTrue(gate.enter(at: rest, secondsSincePointerMoved: 0.02))
        XCTAssertFalse(gate.move(to: CGPoint(x: 720, y: 870)))  // already open: nothing waits
    }

    func testExitDropsTheWaitingEntry() {
        var gate = NotchHoverGate()
        XCTAssertFalse(gate.enter(at: rest, secondsSincePointerMoved: 3))
        gate.exit()
        XCTAssertFalse(gate.move(to: CGPoint(x: 703, y: 880)))
    }
}
