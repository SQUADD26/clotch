import XCTest
@testable import Clotch
import ClotchCore

final class HoverAndDisplaySettingsTests: XCTestCase {
    // MARK: - Hover expand delay

    func testDefaultHoverDelayIsUnchanged() {
        XCTAssertEqual(SettingsDefaults.hoverExpandDelay, 0.5)
        XCTAssertEqual(NotchHoverInteraction.expandDelay(forSetting: SettingsDefaults.hoverExpandDelay), 0.5)
    }

    func testHoverDelayIsClampedIntoTheOfferedRange() {
        XCTAssertEqual(NotchHoverInteraction.expandDelay(forSetting: 0.1), 0.1)
        XCTAssertEqual(NotchHoverInteraction.expandDelay(forSetting: 0.75), 0.75)
        XCTAssertEqual(NotchHoverInteraction.expandDelay(forSetting: 1.0), 1.0)
        // A hand-written or zeroed preference must never produce an instant or
        // negative timer.
        XCTAssertEqual(NotchHoverInteraction.expandDelay(forSetting: 0), 0.1)
        XCTAssertEqual(NotchHoverInteraction.expandDelay(forSetting: -3), 0.1)
        XCTAssertEqual(NotchHoverInteraction.expandDelay(forSetting: 12), 1.0)
    }

    // MARK: - Exit delay (#125)

    func testExitDelayDefaultIsUnchanged() {
        XCTAssertEqual(SettingsDefaults.hoverCollapseDelay, 0.5)
        XCTAssertEqual(NotchHoverInteraction.collapseDelay(forSetting: SettingsDefaults.hoverCollapseDelay), 0.5)
    }

    func testSavedExitDelayIsTheDelayUsedAtClose() {
        // The key the page writes is the one the panel reads; the panel passes it to collapseDelay(forSetting:).
        let suite = UserDefaults(suiteName: "clotch-125-\(UUID().uuidString)")!
        suite.set(0.8, forKey: SettingsKey.hoverCollapseDelay)
        XCTAssertEqual(NotchHoverInteraction.collapseDelay(forSetting: suite.double(forKey: SettingsKey.hoverCollapseDelay)), 0.8)
        suite.set(0.2, forKey: SettingsKey.hoverCollapseDelay)
        XCTAssertEqual(NotchHoverInteraction.collapseDelay(forSetting: suite.double(forKey: SettingsKey.hoverCollapseDelay)), 0.2)
    }

    func testExitDelayIsClampedAndNeverZero() {
        XCTAssertEqual(NotchHoverInteraction.collapseDelay(forSetting: 0), 0.1)
        XCTAssertEqual(NotchHoverInteraction.collapseDelay(forSetting: 12), 1.0)
        XCTAssertEqual(NotchHoverInteraction.collapseDelay(forSetting: .nan), NotchHoverInteraction.collapseDelay)
    }

    func testNonFiniteHoverDelayFallsBackToTheDefault() {
        XCTAssertEqual(NotchHoverInteraction.expandDelay(forSetting: .nan), NotchHoverInteraction.expandDelay)
        XCTAssertEqual(NotchHoverInteraction.expandDelay(forSetting: .infinity), NotchHoverInteraction.expandDelay)
    }

    func testHoverDelayRangeMatchesTheRequestedBounds() {
        XCTAssertEqual(NotchHoverInteraction.expandDelayRange.lowerBound, 0.1)
        XCTAssertEqual(NotchHoverInteraction.expandDelayRange.upperBound, 1.0)
    }

    /// An approval or question card that opened while the hover delay was
    /// running must not be swapped out for the session list when it elapses.
    func testElapsedHoverDelayNeverReplacesAPendingCard() {
        XCTAssertFalse(NotchHoverInteraction.hoverExpansionMayReplace(.approvalCard(sessionId: "s")))
        XCTAssertFalse(NotchHoverInteraction.hoverExpansionMayReplace(.questionCard(sessionId: "s")))
        XCTAssertTrue(NotchHoverInteraction.hoverExpansionMayReplace(.collapsed))
        XCTAssertTrue(NotchHoverInteraction.hoverExpansionMayReplace(.sessionList))
        XCTAssertTrue(NotchHoverInteraction.hoverExpansionMayReplace(.completionCard(sessionId: "s")))
    }

    // MARK: - Content font size

    func testContentFontSizeGoesUpTo16pt() {
        XCTAssertEqual(ContentFontSize.choices.first, 10)
        XCTAssertEqual(ContentFontSize.choices.last, 16)
        XCTAssertEqual(ContentFontSize.choices, Array(10...16), "every step is selectable")
        XCTAssertTrue(ContentFontSize.choices.contains(SettingsDefaults.contentFontSize))
    }
}
