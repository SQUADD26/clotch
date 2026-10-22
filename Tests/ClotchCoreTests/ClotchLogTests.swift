import XCTest
@testable import ClotchCore

/// #264: the tests never log under the app's subsystem.
final class ClotchLogTests: XCTestCase {
    func testAppProcessLogsUnderTheAppSubsystem() {
        XCTAssertEqual(ClotchLog.subsystem(underTest: false), "com.squadd.clotch")
    }

    func testTestProcessLogsUnderTheTestSubsystem() {
        XCTAssertEqual(ClotchLog.subsystem(underTest: true), "com.squadd.clotch.test")
    }

    func testThisProcessIsATestAndDoesNotLogAsTheApp() {
        XCTAssertNotEqual(ClotchLog.subsystem, ClotchLog.appSubsystem)
    }

    /// The class guard: no source names the app's subsystem by hand, so no logger can slip past the test subsystem.
    func testNoSourceNamesTheAppSubsystemByHand() throws {
        let sources = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().appendingPathComponent("Sources")
        let walker = try XCTUnwrap(FileManager.default.enumerator(at: sources, includingPropertiesForKeys: nil))
        var hits: [String] = []
        for case let url as URL in walker where url.pathExtension == "swift" && url.lastPathComponent != "ClotchLog.swift" {
            let text = try String(contentsOf: url, encoding: .utf8)
            if text.contains("subsystem: \"com.squadd.clotch\"") { hits.append(url.lastPathComponent) }
        }
        XCTAssertEqual(hits, [], "use ClotchLog.subsystem")
    }
}
