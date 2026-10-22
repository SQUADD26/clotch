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
}
