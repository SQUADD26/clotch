import XCTest
@testable import ClotchCore

final class DoNotDisturbTests: XCTestCase {
    func testTheFileIsTheSwitch() throws {
        let home = FileManager.default.temporaryDirectory.appendingPathComponent("dnd-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: home) }
        let dnd = DoNotDisturb(home: home)
        XCTAssertEqual(dnd.url.path, home.appendingPathComponent(".config/voce/non-disturbare").path)
        XCTAssertFalse(dnd.isOn, "no file, no folder: off")
        try FileManager.default.createDirectory(at: dnd.url.deletingLastPathComponent(), withIntermediateDirectories: true)
        FileManager.default.createFile(atPath: dnd.url.path, contents: Data())
        XCTAssertTrue(dnd.isOn)
        try FileManager.default.removeItem(at: dnd.url)
        XCTAssertFalse(dnd.isOn)
    }
}
