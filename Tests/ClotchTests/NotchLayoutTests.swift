import XCTest
@testable import Clotch
import ClotchCore

final class NotchLayoutTests: XCTestCase {
    func testStandardLayoutKeepsCentreEmptyOnNotchScreen() {
        XCTAssertTrue(NotchScreenLayout.standard(hasNotch: true).centre.isEmpty)
        XCTAssertEqual(NotchScreenLayout.standard(hasNotch: false).centre, [.activeGoal])
    }

    func testPlaceMovesElementInsteadOfDuplicatingIt() {
        var layout = NotchScreenLayout.standard(hasNotch: false)
        XCTAssertTrue(layout.place(.goalRings, in: .right, hasNotch: false))
        XCTAssertFalse(layout.left.contains(.goalRings))
        XCTAssertEqual(layout.right, [.accounts, .goalRings])
    }

    func testCentreRefusedOnNotchScreen() {
        var layout = NotchScreenLayout.standard(hasNotch: true)
        let before = layout
        XCTAssertFalse(layout.place(.pendingRequests, in: .centre, hasNotch: true))
        XCTAssertEqual(layout, before)
    }

    func testRemove() {
        var layout = NotchScreenLayout.standard(hasNotch: false)
        layout.remove(.activeGoal)
        XCTAssertFalse(layout.contains(.activeGoal))
    }

    func testResolvedMovesCentreToLeftOnNotchScreenOnly() {
        var layout = NotchScreenLayout.standard(hasNotch: false)
        layout.place(.workingSessions, in: .centre, hasNotch: false)
        XCTAssertEqual(layout.resolved(hasNotch: false), layout)
        let resolved = layout.resolved(hasNotch: true)
        XCTAssertTrue(resolved.centre.isEmpty)
        XCTAssertEqual(resolved.left, [.goalRings, .activeGoal, .workingSessions])
    }

    func testStoreKeepsOneLayoutPerScreenAndFallsBackToStandard() {
        var store = NotchLayoutStore()
        var own = NotchScreenLayout.standard(hasNotch: false)
        own.width = 0.9
        store.screens["0:0:1920:1080"] = own
        XCTAssertEqual(store.layout(for: "0:0:1920:1080", hasNotch: false).width, 0.9)
        XCTAssertEqual(store.layout(for: "other", hasNotch: true), .standard(hasNotch: true))
    }

    func testStoreSurvivesSaveAndLoad() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: "NotchLayoutTests-\(UUID().uuidString)"))
        var store = NotchLayoutStore()
        var layout = NotchScreenLayout.standard(hasNotch: false)
        layout.place(.accountsWide, in: .right, hasNotch: false)
        store.screens["sig"] = layout
        store.save(to: defaults)
        XCTAssertEqual(NotchLayoutStore.load(from: defaults), store)
    }

    func testLoadWithNothingOrGarbageGivesEmptyStore() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: "NotchLayoutTests-\(UUID().uuidString)"))
        XCTAssertEqual(NotchLayoutStore.load(from: defaults), NotchLayoutStore())
        defaults.set(Data("nope".utf8), forKey: SettingsKey.notchLayouts)
        XCTAssertEqual(NotchLayoutStore.load(from: defaults), NotchLayoutStore())
    }

    func testOldIslandWidthMovesIntoLarghezzaOnce() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: "NotchLayoutTests-\(UUID().uuidString)"))
        var saved = NotchScreenLayout.standard(hasNotch: true)
        saved.width = 0.5
        NotchLayoutStore(screens: ["saved": saved]).save(to: defaults)
        defaults.set(150, forKey: NotchWidth.oldScaleKey)
        NotchLayoutStore.migrateWidthScale(defaults, screens: [("saved", true), ("new", false)])
        let store = NotchLayoutStore.load(from: defaults)
        XCTAssertEqual(store.screens["saved"]?.width ?? 0, 0.675, accuracy: 0.0001)
        XCTAssertEqual(store.screens["new"]?.width ?? 0, 0.35, accuracy: 0.0001)
        XCTAssertEqual(store.screens["new"]?.centre, [.activeGoal])
        XCTAssertNil(defaults.object(forKey: NotchWidth.oldScaleKey), "runs once")
    }

    func testOldIslandWidthAtOrUnderTheNotchChangesNothing() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: "NotchLayoutTests-\(UUID().uuidString)"))
        defaults.set(80, forKey: NotchWidth.oldScaleKey)
        NotchLayoutStore.migrateWidthScale(defaults, screens: [("new", true)])
        XCTAssertEqual(NotchLayoutStore.load(from: defaults), NotchLayoutStore())
        XCTAssertNil(defaults.object(forKey: NotchWidth.oldScaleKey))
    }

    func testWidthLabelThirds() {
        var layout = NotchScreenLayout.standard(hasNotch: false)
        layout.width = 0.1
        XCTAssertEqual(layout.widthKey, "notch_width_low")
        layout.width = 0.5
        XCTAssertEqual(layout.widthKey, "notch_width_mid")
        layout.width = 0.95
        XCTAssertEqual(layout.widthKey, "notch_width_high")
    }
}
