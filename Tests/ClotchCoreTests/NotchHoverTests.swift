import XCTest
@testable import ClotchCore

/// #264: the closed notch opens from the bar, not from the note line or the buttons under it.
final class NotchHoverTests: XCTestCase {
    // The island column of a closed notch with a note line: 370 wide, the bar 32 high, the note under it.
    private let column = CGRect(x: 125, y: 0, width: 370, height: 32 + 40)
    private let bar: CGFloat = 32

    func testClosedNotchOpensFromTheBar() {
        XCTAssertTrue(NotchHoverArea.opens(at: CGPoint(x: 310, y: 16), column: column, notchHeight: bar, expanded: false))
    }

    func testClosedNotchDoesNotOpenFromTheNoteLine() {
        XCTAssertFalse(NotchHoverArea.opens(at: CGPoint(x: 310, y: 32 + 20), column: column, notchHeight: bar, expanded: false))
    }

    func testClosedNotchDoesNotOpenFromTheFirstPointUnderTheBar() {
        XCTAssertFalse(NotchHoverArea.opens(at: CGPoint(x: 310, y: 33), column: column, notchHeight: bar, expanded: false))
    }

    func testOpenIslandKeepsTheWholeColumn() {  // leaving the bar for the list must not close it
        XCTAssertTrue(NotchHoverArea.opens(at: CGPoint(x: 310, y: 32 + 20), column: column, notchHeight: bar, expanded: true))
    }

    func testOutsideTheColumnNeverOpens() {
        XCTAssertFalse(NotchHoverArea.opens(at: CGPoint(x: 100, y: 16), column: column, notchHeight: bar, expanded: false))
        XCTAssertFalse(NotchHoverArea.opens(at: CGPoint(x: 100, y: 16), column: column, notchHeight: bar, expanded: true))
    }
}
