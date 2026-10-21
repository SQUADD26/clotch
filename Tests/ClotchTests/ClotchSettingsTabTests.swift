import XCTest
@testable import Clotch

final class ClotchSettingsTabTests: XCTestCase {
    /// «Dettatura» (#110) sits right after «Voce», has its own icon, and every language names it.
    func testDictationTabFollowsVoice() throws {
        let tabs = ClotchSettingsTab.allCases
        XCTAssertEqual(tabs.firstIndex(of: .dictation), try XCTUnwrap(tabs.firstIndex(of: .voice)) + 1)
        XCTAssertEqual(ClotchSettingsTab.dictation.symbol, "mic.fill")
        for (lang, table) in L10n.strings { XCTAssertNotNil(table["dictation_page"], "\(lang) lacks dictation_page") }
        XCTAssertEqual(L10n.strings["it"]?["dictation_page"], "Dettatura")
        XCTAssertEqual(L10n.strings["en"]?["dictation_page"], "Dictation")
    }
}
