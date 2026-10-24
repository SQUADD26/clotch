import XCTest
@testable import Clotch

/// #465: l'URL dell'app «clotch» dentro il bundle di Clotch. Solo cartelle temporanee, nessuna app avviata.
final class AppSessioniTests: XCTestCase {
    private var tmp: URL!

    override func setUpWithError() throws {
        tmp = FileManager.default.temporaryDirectory.appendingPathComponent("appsessioni-\(UUID().uuidString)/Clotch.app", isDirectory: true)
        try FileManager.default.createDirectory(at: tmp.appendingPathComponent("Contents"), withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: tmp.deletingLastPathComponent())
    }

    func testUrlTrovaAppIncorporata() throws {
        let inner = tmp.appendingPathComponent("Contents/Helpers/clotch.app", isDirectory: true)
        try FileManager.default.createDirectory(at: inner, withIntermediateDirectories: true)
        let bundle = try XCTUnwrap(Bundle(url: tmp))
        XCTAssertEqual(AppSessioni.url(in: bundle)?.standardizedFileURL.path, inner.standardizedFileURL.path)
    }

    func testSenzaAppIncorporataNonApreNulla() throws {
        let bundle = try XCTUnwrap(Bundle(url: tmp))
        XCTAssertNil(AppSessioni.url(in: bundle))
        XCTAssertFalse(AppSessioni.apri(in: bundle))
    }
}
