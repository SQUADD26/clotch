import AppKit
import XCTest
@testable import Clotch

final class ScreenDetectorTests: XCTestCase {
    func testAutoPreferredIndexUsesActiveWorkScreenBeforeBuiltInScreen() {
        let candidates = [
            ScreenDetector.Candidate(
                frame: NSRect(x: 0, y: 0, width: 1512, height: 982),
                hasNotch: true,
                isMain: true
            ),
            ScreenDetector.Candidate(
                frame: NSRect(x: 1512, y: 0, width: 1920, height: 1080),
                hasNotch: false,
                isMain: false
            )
        ]

        let index = ScreenDetector.autoPreferredIndex(
            candidates: candidates,
            activeWindowBounds: NSRect(x: 1800, y: 100, width: 1000, height: 800)
        )

        XCTAssertEqual(index, 1)
    }

    func testAutoPreferredIndexFallsBackToBuiltInScreenWhenNoActiveWorkScreenExists() {
        let candidates = [
            ScreenDetector.Candidate(
                frame: NSRect(x: 0, y: 0, width: 1512, height: 982),
                hasNotch: true,
                isMain: false
            ),
            ScreenDetector.Candidate(
                frame: NSRect(x: 1512, y: 0, width: 1920, height: 1080),
                hasNotch: false,
                isMain: true
            )
        ]

        let index = ScreenDetector.autoPreferredIndex(
            candidates: candidates,
            activeWindowBounds: nil
        )

        XCTAssertEqual(index, 0)
    }

    func testAutoPreferredIndexFallsBackToMainScreenWhenNoBuiltInScreenExists() {
        let candidates = [
            ScreenDetector.Candidate(
                frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
                hasNotch: false,
                isMain: false
            ),
            ScreenDetector.Candidate(
                frame: NSRect(x: 1920, y: 0, width: 1920, height: 1080),
                hasNotch: false,
                isMain: true
            )
        ]

        let index = ScreenDetector.autoPreferredIndex(
            candidates: candidates,
            activeWindowBounds: nil
        )

        XCTAssertEqual(index, 1)
    }

    private let builtIn = CGRect(x: 0, y: 0, width: 1512, height: 982)
    private let external = CGRect(x: 1512, y: 0, width: 1920, height: 1080)

    func testFixedChoiceIgnoresMouse() {
        let choice = ScreenDetector.fixedPrefix + ScreenDetector.signature(of: builtIn)
        let index = ScreenDetector.selectedIndex(choice: choice, frames: [builtIn, external], mouse: CGPoint(x: 2000, y: 500))
        XCTAssertEqual(index, 0)
    }

    func testFollowMouseChoosesScreenUnderPointer() {
        let frames = [builtIn, external]
        XCTAssertEqual(ScreenDetector.selectedIndex(choice: ScreenDetector.followMouseChoice, frames: frames, mouse: CGPoint(x: 100, y: 100)), 0)
        XCTAssertEqual(ScreenDetector.selectedIndex(choice: ScreenDetector.followMouseChoice, frames: frames, mouse: CGPoint(x: 2000, y: 500)), 1)
    }

    func testFixedScreenRemovedFallsBack() {
        let choice = ScreenDetector.fixedPrefix + ScreenDetector.signature(of: external)
        XCTAssertNil(ScreenDetector.selectedIndex(choice: choice, frames: [builtIn], mouse: .zero))
    }

    func testFollowMouseOutsideEveryScreenTakesNearest() {
        XCTAssertEqual(ScreenDetector.selectedIndex(choice: ScreenDetector.followMouseChoice, frames: [builtIn, external], mouse: CGPoint(x: 5000, y: 5000)), 1)
    }

    /// The top row reports mouseLocation.y == maxY: still the screen under the pointer, not the auto fallback (#35).
    func testFollowMouseOnTopRowKeepsThatScreen() {
        XCTAssertEqual(ScreenDetector.selectedIndex(choice: ScreenDetector.followMouseChoice, frames: [builtIn, external], mouse: CGPoint(x: 2000, y: 1080)), 1)
    }

    func testAutoAndLegacyIndexChoice() {
        XCTAssertNil(ScreenDetector.selectedIndex(choice: "auto", frames: [builtIn, external], mouse: .zero))
        XCTAssertEqual(ScreenDetector.selectedIndex(choice: "screen_1", frames: [builtIn, external], mouse: .zero), 1)
        XCTAssertNil(ScreenDetector.selectedIndex(choice: "screen_2", frames: [builtIn, external], mouse: .zero))
    }
}
