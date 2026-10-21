import XCTest
@testable import ClotchCore

final class LegacyDefaultsTests: XCTestCase {
    private var defaults: UserDefaults!
    private let suite = "LegacyDefaultsTests"

    override func setUp() {
        defaults = UserDefaults(suiteName: suite)
        defaults.removePersistentDomain(forName: suite)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suite)
    }

    func testCopiesOldKeysWithoutOverwritingAndSkipsSparkle() {
        defaults.set("de", forKey: "appLanguage")
        LegacyDefaults.copyOnce(
            from: ["appLanguage": "it", "goalnotch.rejectedProposals": ["a"], "SUHasLaunchedBefore": true],
            into: defaults
        )
        XCTAssertEqual(defaults.string(forKey: "appLanguage"), "de")
        XCTAssertEqual(defaults.stringArray(forKey: "goalnotch.rejectedProposals"), ["a"])
        XCTAssertNil(defaults.object(forKey: "SUHasLaunchedBefore"))
    }

    func testRunsOnlyOnce() {
        LegacyDefaults.copyOnce(from: ["a": 1], into: defaults)
        defaults.removeObject(forKey: "a")
        LegacyDefaults.copyOnce(from: ["a": 1, "b": 2], into: defaults)
        XCTAssertNil(defaults.object(forKey: "a"))
        XCTAssertNil(defaults.object(forKey: "b"))
    }

    func testRenamesOldKeysWithoutOverwriting() {
        defaults.set(["a"], forKey: "goalnotch.rejectedProposals")
        defaults.set(["old"], forKey: "goalnotch.seenMergedPRs")
        defaults.set(["new"], forKey: "clotch.seenMergedPRs")
        LegacyDefaults.renameKeys(in: defaults)
        XCTAssertEqual(defaults.stringArray(forKey: "clotch.rejectedProposals"), ["a"])
        XCTAssertEqual(defaults.stringArray(forKey: "clotch.seenMergedPRs"), ["new"])
        XCTAssertNil(defaults.object(forKey: "goalnotch.rejectedProposals"))
        XCTAssertNil(defaults.object(forKey: "goalnotch.seenMergedPRs"))
    }

    func testNoOldDomainStillMarksDone() {
        LegacyDefaults.copyOnce(from: nil, into: defaults)
        LegacyDefaults.copyOnce(from: ["a": 1], into: defaults)
        XCTAssertNil(defaults.object(forKey: "a"))
    }
}
