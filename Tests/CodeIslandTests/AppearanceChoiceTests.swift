import XCTest
@testable import CodeIsland

final class AppearanceChoiceTests: XCTestCase {
    private func freshDefaults() throws -> UserDefaults {
        try XCTUnwrap(UserDefaults(suiteName: "AppearanceChoiceTests-\(UUID().uuidString)"))
    }

    func testDarkIsTheDefault() throws {
        XCTAssertEqual(AppearanceChoice.read(from: try freshDefaults()), .dark)
    }

    func testGarbageFallsBackToDark() throws {
        let defaults = try freshDefaults()
        defaults.set("neon", forKey: SettingsKey.windowAppearance)
        XCTAssertEqual(AppearanceChoice.read(from: defaults), .dark)
    }

    func testStoredChoiceIsRead() throws {
        let defaults = try freshDefaults()
        defaults.set("light", forKey: SettingsKey.windowAppearance)
        XCTAssertEqual(AppearanceChoice.read(from: defaults), .light)
    }

    func testSystemFollowsTheSystemAndOthersForceAnAppearance() {
        XCTAssertNil(AppearanceChoice.system.nsAppearance)
        XCTAssertEqual(AppearanceChoice.dark.nsAppearance?.name, .darkAqua)
        XCTAssertEqual(AppearanceChoice.light.nsAppearance?.name, .aqua)
    }
}
