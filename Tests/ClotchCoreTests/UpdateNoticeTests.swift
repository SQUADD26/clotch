import XCTest
@testable import ClotchCore

final class UpdateNoticeTests: XCTestCase {
    func testSaysOnlyANewBuild() throws {
        let d = try XCTUnwrap(UserDefaults(suiteName: "aggiorna-\(UUID().uuidString)"))
        XCTAssertNil(UpdateNotice.line(build: "1.0.38.900", defaults: d))  // first launch: nothing to compare
        XCTAssertNil(UpdateNotice.line(build: "1.0.38.900", defaults: d))  // same build relaunched
        XCTAssertEqual(UpdateNotice.line(build: "1.0.38.912", defaults: d), "Mi sono aggiornata alla versione 1.0.38.912.")
        XCTAssertNil(UpdateNotice.line(build: "1.0.38.912", defaults: d))
    }
}
