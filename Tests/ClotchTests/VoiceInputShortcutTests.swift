import XCTest
@testable import Clotch
import ClotchCore

/// #198: the dictation key is never mute. Switched off or not registered, the pill says so and offers the Dettatura page.
@MainActor
final class VoiceInputShortcutTests: XCTestCase {
    private func controller(enabled: Bool) throws -> (VoiceInputController, URL) {
        let home = FileManager.default.temporaryDirectory.appendingPathComponent("clotch-198-\(UUID().uuidString)")
        let voce = home.appendingPathComponent(".config/voce")
        try FileManager.default.createDirectory(at: voce, withIntermediateDirectories: true)
        try JSONSerialization.data(withJSONObject: ["ingresso_acceso": enabled]).write(to: voce.appendingPathComponent("config.json"))
        return (VoiceInputController(files: VoiceFiles(home: home)), home)
    }

    func testPressWithDictationOffShowsThePill() throws {
        let (c, home) = try controller(enabled: false)
        defer { try? FileManager.default.removeItem(at: home) }
        c.press()
        XCTAssertEqual(c.phase, .failure(.off))
        XCTAssertEqual(c.light, .red)
    }

    func testShortcutThatCannotBeRegisteredShowsThePill() throws {
        let (c, home) = try controller(enabled: true)
        defer { try? FileManager.default.removeItem(at: home) }
        c.shortcutNotRegistered()
        XCTAssertEqual(c.phase, .failure(.shortcut))
    }
}
