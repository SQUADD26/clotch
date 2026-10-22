import XCTest
@testable import Clotch

/// #207: the notch must not open by itself on a question, permission or
/// completion when the user never chose otherwise.
@MainActor
final class AutoExpandDefaultsTests: XCTestCase {
    private var defaults: UserDefaults!
    private let suiteName = "AutoExpandDefaultsTests"

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: suiteName)
        defaults.removePersistentDomain(forName: suiteName)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        super.tearDown()
    }

    func testAutoExpandDefaultsAreOff() {
        XCTAssertFalse(SettingsDefaults.autoExpandOnPermission)
        XCTAssertFalse(SettingsDefaults.autoExpandOnCompletion)
        XCTAssertFalse(SettingsDefaults.autoExpandOnQuestion)
        XCTAssertFalse(AppState.autoExpandOnPermission(defaults))
        XCTAssertFalse(AppState.autoExpandOnQuestion(defaults))
    }
}
