import XCTest
import SwiftUI
import ClotchCore
@testable import Clotch

/// The shell's springs read the times saved in Settings (#68); the math is in NotchTimingTests.
final class NotchAnimationTimingTests: XCTestCase {
    private let keys = [SettingsKey.notchOpenMs, SettingsKey.notchCloseMs]
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

    func testSavedTimesDriveTheShellSprings() throws {
        try XCTSkipIf(NSWorkspace.shared.accessibilityDisplayShouldReduceMotion, "Reduce Motion swaps the springs for a fade")
        UserDefaults.standard.set(300, forKey: SettingsKey.notchOpenMs)
        UserDefaults.standard.set(150, forKey: SettingsKey.notchCloseMs)
        XCTAssertEqual(NotchAnimation.open, .spring(duration: 0.3, bounce: 0))
        XCTAssertEqual(NotchAnimation.close, .spring(duration: 0.15, bounce: 0))

        UserDefaults.standard.set(400, forKey: SettingsKey.notchCloseMs)
        XCTAssertEqual(NotchAnimation.close, .spring(duration: 0.4, bounce: 0))
        XCTAssertEqual(NotchAnimation.open, .spring(duration: 0.3, bounce: 0))
    }
}
