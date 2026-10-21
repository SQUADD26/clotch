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
