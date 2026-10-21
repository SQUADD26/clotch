import XCTest
@testable import ClotchCore

/// #56: every new setting is saved and read back, and the values the notch uses stay sane.
final class ClotchPrefsTests: XCTestCase {
    private let suite = "ClotchPrefsTests"

    func testEverySettingSavesAndReadsBack() {
        let d = UserDefaults(suiteName: suite)!
        defer { d.removePersistentDomain(forName: suite) }
        d.set(false, forKey: ClotchPrefs.openOnHover)
        d.set(false, forKey: ClotchPrefs.notes)
        d.set(ClotchPrefs.NoteLength.long.rawValue, forKey: ClotchPrefs.noteLength)
        d.set("requests,accounts", forKey: ClotchPrefs.hiddenTabs)
        d.set(false, forKey: ClotchPrefs.voiceLight)
        d.set(0.5, forKey: ClotchPrefs.voiceLightStrength)

        let again = UserDefaults(suiteName: suite)!
        XCTAssertEqual(again.object(forKey: ClotchPrefs.openOnHover) as? Bool, false)
        XCTAssertEqual(again.object(forKey: ClotchPrefs.notes) as? Bool, false)
        XCTAssertEqual(again.string(forKey: ClotchPrefs.noteLength), "long")
        XCTAssertEqual(again.string(forKey: ClotchPrefs.hiddenTabs), "requests,accounts")
        XCTAssertEqual(again.object(forKey: ClotchPrefs.voiceLight) as? Bool, false)
        XCTAssertEqual(again.double(forKey: ClotchPrefs.voiceLightStrength), 0.5)
        XCTAssertEqual(Set([ClotchPrefs.openOnHover, ClotchPrefs.notes, ClotchPrefs.noteLength, ClotchPrefs.hiddenTabs,
                            ClotchPrefs.voiceLight, ClotchPrefs.voiceLightStrength]).count, 6, "one key per setting")
    }

    func testNoteLengthAndStrength() {
        XCTAssertEqual(ClotchPrefs.noteScale("short"), 0.6)
        XCTAssertEqual(ClotchPrefs.noteScale(ClotchPrefs.noteLengthDefault), 1)
        XCTAssertEqual(ClotchPrefs.noteScale("??"), 1, "an unknown value is the normal length")
        XCTAssertEqual(ClotchPrefs.strength(0), 0.3)
        XCTAssertEqual(ClotchPrefs.strength(2), 1)
    }

    func testTabsNeverAllHidden() {
        let all = ["goals", "requests", "accounts"]
        XCTAssertEqual(ClotchPrefs.visibleTabs(all, hidden: ""), all)
        var raw = ClotchPrefs.setTab("requests", on: false, hidden: "", all: all)
        XCTAssertEqual(ClotchPrefs.visibleTabs(all, hidden: raw), ["goals", "accounts"])
        raw = ClotchPrefs.setTab("goals", on: false, hidden: raw, all: all)
        XCTAssertEqual(ClotchPrefs.setTab("accounts", on: false, hidden: raw, all: all), raw, "the last tab stays on")
        XCTAssertEqual(ClotchPrefs.visibleTabs(all, hidden: "goals,requests,accounts"), all, "never an empty notch")
        XCTAssertEqual(ClotchPrefs.setTab("goals", on: true, hidden: raw, all: all), "requests")
    }
}
