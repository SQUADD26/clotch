import XCTest
@testable import ClotchCore

/// claude-config#1967: a card that could not be read is not «Nessuna domanda». The tab says which of the three it shows.
final class AdhdScreenTests: XCTestCase {
    private let one = GoalSources.parseAdhd(Data(#"[{"id":"Q-1","domanda_chiara":"Come fa il coccodrillo?"}]"#.utf8))

    func testReadFailedWithEmptyListIsNotEmpty() {
        XCTAssertEqual(AdhdScreen.of(items: [], readError: "Il comando è uscito con errore 1."), .readFailed("Il comando è uscito con errore 1."))
    }

    func testReadFailedWithAListKeepsTheList() {
        XCTAssertEqual(AdhdScreen.of(items: one, readError: "boom"), .list)
    }

    func testReadWorkedAndEmptyIsEmpty() {
        XCTAssertEqual(AdhdScreen.of(items: [], readError: nil), .empty)
    }

    func testReadWorkedWithAListIsTheList() {
        XCTAssertEqual(AdhdScreen.of(items: one, readError: nil), .list)
    }
}
