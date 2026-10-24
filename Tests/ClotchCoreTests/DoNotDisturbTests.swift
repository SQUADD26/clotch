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

    func testTheEnginesSilenceFileWinsOverTheOldOne() throws {
        let home = FileManager.default.temporaryDirectory.appendingPathComponent("dnd-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: home) }
        let door = FridayDoor(home: home)
        try FileManager.default.createDirectory(at: door.silenceURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data(#"{"acceso":false,"fino":null,"zitto_fino":"2999-01-01T00:00:00Z","lontano":false}"#.utf8).write(to: door.silenceURL)
        XCTAssertTrue(DoNotDisturb(home: home).isOn, "zitto_fino in the future")
        try Data(#"{"acceso":false,"fino":null,"zitto_fino":"2000-01-01T00:00:00Z","lontano":false}"#.utf8).write(to: door.silenceURL)
        XCTAssertFalse(DoNotDisturb(home: home).isOn)
    }
}
