import XCTest
@testable import Clotch

final class SingleInstanceTests: XCTestCase {
    private let id = "com.squadd.clotch"

    func testNoOtherCopyMeansNothingToClose() {
        let running = [SingleInstance.Proc(pid: 10, bundleID: id)]
        XCTAssertEqual(SingleInstance.pidsToClose(ownPID: 10, ownBundleID: id, running: running), [])
    }

    func testEveryOtherCopyWithTheSameBundleIDIsClosed() {
        let running = [
            SingleInstance.Proc(pid: 10, bundleID: id),
            SingleInstance.Proc(pid: 20, bundleID: id),
            SingleInstance.Proc(pid: 30, bundleID: id),
            SingleInstance.Proc(pid: 40, bundleID: "com.apple.finder"),
        ]
        XCTAssertEqual(SingleInstance.pidsToClose(ownPID: 20, ownBundleID: id, running: running), [10, 30])
    }

    func testWithoutOwnBundleIDNothingIsClosed() {
        let running = [SingleInstance.Proc(pid: 10, bundleID: nil), SingleInstance.Proc(pid: 20, bundleID: nil)]
        XCTAssertEqual(SingleInstance.pidsToClose(ownPID: 20, ownBundleID: nil, running: running), [])
    }
}
