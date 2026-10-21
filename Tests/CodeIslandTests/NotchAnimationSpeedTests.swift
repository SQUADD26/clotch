import XCTest
import SwiftUI
@testable import CodeIsland

final class NotchAnimationSpeedTests: XCTestCase {
    private let keys = [SettingsKey.notchOpenSpeed, SettingsKey.notchCloseSpeed]
    private var previous: [String: Any] = [:]

    override func setUp() {
        previous = keys.reduce(into: [:]) { $0[$1] = UserDefaults.standard.object(forKey: $1) }
    }

    override func tearDown() {
        for key in keys {
            if let value = previous[key] { UserDefaults.standard.set(value, forKey: key) }
            else { UserDefaults.standard.removeObject(forKey: key) }
        }
    }

    func testExplicitNonPositiveSpeedClampsToMinimum() {
        XCTAssertEqual(NotchAnimationSpeed.clamped(0), 0.5)
        XCTAssertEqual(NotchAnimationSpeed.clamped(-1), 0.5)
    }

    func testSpeedIsClampedToTheSliderRange() {
        XCTAssertEqual(NotchAnimationSpeed.clamped(0.1), 0.5)
        XCTAssertEqual(NotchAnimationSpeed.clamped(99), 2.0)
        XCTAssertEqual(NotchAnimationSpeed.clamped(1.3), 1.3, accuracy: 0.0001)
    }

    func testHigherSpeedShortensTheSpringResponse() {
        XCTAssertEqual(
            NotchAnimationSpeed.response(base: 0.42, speed: 2.0),
            0.21,
            accuracy: 0.0001
        )
    }

    func testLowerSpeedLengthensTheSpringResponse() {
        XCTAssertEqual(
            NotchAnimationSpeed.response(base: 0.42, speed: 0.5),
            0.84,
            accuracy: 0.0001
        )
    }

    func testShippedOpenAndCloseResponsesRemainDistinct() {
        XCTAssertEqual(NotchAnimationMetrics.baseOpenResponse, 0.42, accuracy: 0.0001)
        XCTAssertEqual(NotchAnimationMetrics.baseCloseResponse, 0.38, accuracy: 0.0001)
    }

    func testOpenAndCloseSpeedsAreStoredApart() {
        UserDefaults.standard.set(2.0, forKey: SettingsKey.notchOpenSpeed)
        UserDefaults.standard.set(0.5, forKey: SettingsKey.notchCloseSpeed)

        XCTAssertEqual(NotchAnimationMetrics.openResponse, 0.21, accuracy: 0.0001)
        XCTAssertEqual(NotchAnimationMetrics.closeResponse, 0.76, accuracy: 0.0001)
    }

    func testChangingOneSpeedLeavesTheOtherAlone() {
        UserDefaults.standard.removeObject(forKey: SettingsKey.notchOpenSpeed)
        UserDefaults.standard.set(2.0, forKey: SettingsKey.notchCloseSpeed)

        XCTAssertEqual(NotchAnimationMetrics.openResponse, 0.42, accuracy: 0.0001)
        XCTAssertEqual(NotchAnimationMetrics.closeResponse, 0.19, accuracy: 0.0001)
    }

    func testMissingStoredSpeedsUseNormalResponses() {
        keys.forEach { UserDefaults.standard.removeObject(forKey: $0) }

        XCTAssertEqual(NotchAnimationMetrics.openResponse, 0.42, accuracy: 0.0001)
        XCTAssertEqual(NotchAnimationMetrics.closeResponse, 0.38, accuracy: 0.0001)
    }

    func testStoredSpeedsChangeTheAnimationsThePanelUses() {
        UserDefaults.standard.set(1.0, forKey: SettingsKey.notchOpenSpeed)
        UserDefaults.standard.set(1.0, forKey: SettingsKey.notchCloseSpeed)
        let slowClose = Animation.spring(response: NotchAnimationMetrics.closeResponse, dampingFraction: 1.0)
        XCTAssertEqual(NotchAnimation.close, slowClose)

        UserDefaults.standard.set(2.0, forKey: SettingsKey.notchCloseSpeed)
        XCTAssertNotEqual(NotchAnimation.close, slowClose)
        XCTAssertEqual(NotchAnimation.open, Animation.spring(response: 0.42, dampingFraction: NotchMotion.damping))
    }
}
