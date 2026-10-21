import XCTest
@testable import CodeIslandCore

final class NotchTimingTests: XCTestCase {
    private var defaults: UserDefaults!
    private let suite = "NotchTimingTests"

    override func setUp() {
        defaults = UserDefaults(suiteName: suite)
        defaults.removePersistentDomain(forName: suite)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suite)
    }

    func testMillisecondsBecomeASpringOfThatDurationWithNoBounce() {
        let s = NotchTiming.spring(ms: 250)
        XCTAssertEqual(s.duration, 0.25, accuracy: 0.0001)
        XCTAssertEqual(s.bounce, 0)
    }

    func testContentEntersAfterTheShellAndEndsWithIt() {
        let c = NotchTiming.contentIn(openMs: 250)
        XCTAssertEqual(c.delay, 0.075, accuracy: 0.0001)
        XCTAssertEqual(c.delay + c.duration, 0.25, accuracy: 0.0001)
        XCTAssertEqual(NotchTiming.contentOut(closeMs: 200), 0.1, accuracy: 0.0001)
    }

    func testOutOfRangeValuesAreLimited() {
        XCTAssertEqual(NotchTiming.clamped(0), 100)
        XCTAssertEqual(NotchTiming.clamped(-5), 100)
        XCTAssertEqual(NotchTiming.clamped(99_999), 1000)
        XCTAssertEqual(NotchTiming.spring(ms: 5).duration, 0.1, accuracy: 0.0001)
        defaults.set(5000, forKey: NotchTiming.openKey)
        XCTAssertEqual(NotchTiming.openMs(defaults), 1000)
    }

    func testDefaultsAreFastAndClosingIsFaster() {
        XCTAssertEqual(NotchTiming.openMs(defaults), 250)
        XCTAssertEqual(NotchTiming.closeMs(defaults), 200)
    }

    func testOldSpeedMultipliersBecomeTheTimeTheyGave() {
        defaults.set(2.0, forKey: "notchOpenSpeed")   // 420 ms / 2
        defaults.set(0.5, forKey: "notchCloseSpeed")  // 380 ms / 0.5
        NotchTiming.migrate(defaults)
        XCTAssertEqual(NotchTiming.openMs(defaults), 210)
        XCTAssertEqual(NotchTiming.closeMs(defaults), 760)
        XCTAssertNil(defaults.object(forKey: "notchOpenSpeed"))
        XCTAssertNil(defaults.object(forKey: "notchCloseSpeed"))
    }

    func testMigrationKeepsATimeAlreadyChosenAndSkipsBadSpeeds() {
        defaults.set(300, forKey: NotchTiming.openKey)
        defaults.set(2.0, forKey: "notchOpenSpeed")
        defaults.set(0.0, forKey: "notchCloseSpeed")
        NotchTiming.migrate(defaults)
        XCTAssertEqual(NotchTiming.openMs(defaults), 300)
        XCTAssertEqual(NotchTiming.closeMs(defaults), 200)
        XCTAssertNil(defaults.object(forKey: "notchCloseSpeed"))
    }

    func testNothingSavedMeansNothingMigrated() {
        NotchTiming.migrate(defaults)
        XCTAssertNil(defaults.object(forKey: NotchTiming.openKey))
        XCTAssertNil(defaults.object(forKey: NotchTiming.closeKey))
    }
}
