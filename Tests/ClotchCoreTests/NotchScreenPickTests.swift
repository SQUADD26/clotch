import XCTest
@testable import ClotchCore

final class NotchScreenPickTests: XCTestCase {
    // Cocoa layout: built-in (primary) at the origin, one screen above, one to the left, one below.
    private let builtIn = CGRect(x: 0, y: 0, width: 1512, height: 982)
    private let above = CGRect(x: -200, y: 982, width: 1920, height: 1080)
    private let left = CGRect(x: -2560, y: -200, width: 2560, height: 1440)
    private let below = CGRect(x: 0, y: -1117, width: 1728, height: 1117)
    private var frames: [CGRect] { [builtIn, above, left, below] }

    func testPointerInsideEachScreenPicksThatScreen() {
        XCTAssertEqual(NotchScreenPick.index(of: CGPoint(x: 700, y: 500), in: frames), 0)
        XCTAssertEqual(NotchScreenPick.index(of: CGPoint(x: 500, y: 1500), in: frames), 1)
        XCTAssertEqual(NotchScreenPick.index(of: CGPoint(x: -1000, y: 300), in: frames), 2)
        XCTAssertEqual(NotchScreenPick.index(of: CGPoint(x: 800, y: -600), in: frames), 3)
    }

    /// The notch sits on the top row, where mouseLocation.y == maxY: that is still this screen,
    /// never the screen stacked above, never a fallback (the bug of #35).
    func testTopRowStaysOnItsOwnScreen() {
        XCTAssertEqual(NotchScreenPick.index(of: CGPoint(x: 700, y: 982), in: frames), 0)
        XCTAssertEqual(NotchScreenPick.index(of: CGPoint(x: 500, y: 2062), in: frames), 1)
        XCTAssertEqual(NotchScreenPick.index(of: CGPoint(x: -1000, y: 1240), in: frames), 2)
        XCTAssertEqual(NotchScreenPick.index(of: CGPoint(x: 800, y: 0), in: frames), 3)
    }

    func testBottomRowAndLeftEdge() {
        XCTAssertEqual(NotchScreenPick.index(of: CGPoint(x: 700, y: 983), in: frames), 1)
        XCTAssertEqual(NotchScreenPick.index(of: CGPoint(x: 0, y: 500), in: frames), 0)
        XCTAssertEqual(NotchScreenPick.index(of: CGPoint(x: -1, y: 500), in: frames), 2)
    }

    func testPointerOutsideEveryScreenTakesNearest() {
        XCTAssertEqual(NotchScreenPick.index(of: CGPoint(x: 1600, y: 400), in: frames), 0)
        XCTAssertEqual(NotchScreenPick.index(of: CGPoint(x: -3000, y: 0), in: frames), 2)
        XCTAssertNil(NotchScreenPick.index(of: .zero, in: []))
    }

    /// A window at the top of the screen above, in CGWindowList coordinates (y down from the primary top).
    func testQuartzWindowMapsToTheScreenAbove() {
        let quartz = CGRect(x: 100, y: -1000, width: 800, height: 600)
        let cocoa = NotchScreenPick.cocoaRect(fromQuartz: quartz, primaryHeight: 982)
        XCTAssertEqual(cocoa, CGRect(x: 100, y: 1382, width: 800, height: 600))
        XCTAssertEqual(NotchScreenPick.index(of: CGPoint(x: cocoa.midX, y: cocoa.midY), in: frames), 1)
    }
}
