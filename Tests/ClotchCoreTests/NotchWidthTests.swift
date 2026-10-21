import XCTest
@testable import ClotchCore

final class NotchWidthTests: XCTestCase {
    /// Every «Larghezza» from the narrowest closed notch to the window: opening never makes it narrower (#99).
    func testOpenIsNeverNarrowerThanClosed() {
        for screenWidth: CGFloat in [1280, 1512, 1728, 1920] {
            let window = NotchWidth.window(screenWidth: screenWidth)
            for closed in stride(from: CGFloat(300), through: window, by: 1) {
                let open = NotchWidth.open(notchWidth: 185, standard: 560, closed: closed, window: window)
                XCTAssertGreaterThanOrEqual(open, closed, "screen \(screenWidth), closed \(closed)")
                XCTAssertLessThanOrEqual(open, window)
            }
        }
    }

    func testOpenKeepsItsOwnWidthWhenTheClosedIsNarrow() {
        XCTAssertEqual(NotchWidth.open(notchWidth: 185, standard: 560, closed: 353, window: 620), 560)
        XCTAssertEqual(NotchWidth.open(notchWidth: 185, standard: 560, closed: 600, window: 620), 600)
        XCTAssertEqual(NotchWidth.open(notchWidth: 185, standard: 560, closed: 620, window: 620), 620)
    }

    func testWindowIsTheWidestOnEveryScreen() {
        XCTAssertEqual(NotchWidth.window(screenWidth: 1512), 620)
        XCTAssertEqual(NotchWidth.window(screenWidth: 600), 560)
    }

    func testOldScaleOnlyWidens() {
        XCTAssertEqual(NotchWidth.fraction(fromScale: 50), 0)
        XCTAssertEqual(NotchWidth.fraction(fromScale: 100), 0)
        XCTAssertEqual(NotchWidth.fraction(fromScale: 150), 0.35, accuracy: 0.0001)
        XCTAssertEqual(NotchWidth.fraction(fromScale: 900), 0.35, accuracy: 0.0001)
        XCTAssertEqual(NotchWidth.merged(width: 0, scale: 150), 0.35, accuracy: 0.0001)
        XCTAssertEqual(NotchWidth.merged(width: 1, scale: 150), 1)
        XCTAssertEqual(NotchWidth.merged(width: 0.5, scale: 100), 0.5)
    }
}
