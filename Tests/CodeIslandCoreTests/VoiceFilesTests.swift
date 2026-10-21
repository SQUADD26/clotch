import XCTest
@testable import CodeIslandCore

/// #38: the «Voce» settings page keeps config.json's unknown fields, writes the key 600, empty instructions = stock ones.
final class VoiceFilesTests: XCTestCase {
    private var home: URL!
    private var files: VoiceFiles!

    override func setUpWithError() throws {
        home = FileManager.default.temporaryDirectory.appendingPathComponent("voce-\(UUID().uuidString)")
        files = VoiceFiles(home: home)
    }

    override func tearDownWithError() throws { try? FileManager.default.removeItem(at: home) }

    private func mode(_ url: URL) throws -> Int {
        try (FileManager.default.attributesOfItem(atPath: url.path)[.posixPermissions] as! NSNumber).intValue
    }

    private func put(_ text: String, _ url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try text.write(to: url, atomically: true, encoding: .utf8)
    }

    func testUpdateKeepsUnknownFields() throws {
        try put(#"{"voice_id": "abc123", "silenzio": [1, 2], "futuro": {"x": true}}"#, files.configURL)
        try files.updateConfig(["speed": 1.3, "voice_id": "nuovo99"])
        let c = try files.readConfig()
        XCTAssertEqual(c["voice_id"] as? String, "nuovo99")
        XCTAssertEqual(c["speed"] as? Double, 1.3)
        XCTAssertEqual(c["silenzio"] as? [Int], [1, 2])
        XCTAssertEqual((c["futuro"] as? [String: Bool])?["x"], true)
        XCTAssertEqual(try mode(files.configURL), 0o600)
    }

    func testBrokenConfigIsNeverOverwritten() throws {
        try put("non json", files.configURL)
        XCTAssertThrowsError(try files.updateConfig(["speed": 1.0]))
        XCTAssertEqual(try String(contentsOf: files.configURL, encoding: .utf8), "non json")
    }

    func testKeySaved600AndTrimmed() throws {
        XCTAssertFalse(files.hasKey)
        try files.saveKey("  sk_segreta123 \n")
        XCTAssertTrue(files.hasKey)
        XCTAssertEqual(try String(contentsOf: files.keyURL, encoding: .utf8), "sk_segreta123")
        XCTAssertEqual(try mode(files.keyURL), 0o600)
        XCTAssertEqual(try mode(files.keyURL.deletingLastPathComponent()), 0o700)
    }

    func testOnOff() throws {
        XCTAssertTrue(files.isOn)
        try files.setOn(false)
        XCTAssertFalse(files.isOn)
        try files.setOn(true)
        XCTAssertTrue(files.isOn)
    }

    func testEmptyPromptIsStock() throws {
        try put("Istruzioni di serie\n", files.defaultPromptURL)
        XCTAssertEqual(files.prompt, "Istruzioni di serie\n")
        try files.savePrompt("Parla piano")
        XCTAssertEqual(files.prompt, "Parla piano")
        XCTAssertEqual(try mode(files.promptURL), 0o600)
        try files.savePrompt("  \n")
        XCTAssertFalse(FileManager.default.fileExists(atPath: files.promptURL.path))
        XCTAssertEqual(files.prompt, "Istruzioni di serie\n")
        try files.savePrompt("Parla piano")
        try files.savePrompt("Istruzioni di serie")
        XCTAssertFalse(FileManager.default.fileExists(atPath: files.promptURL.path), "the stock text = no own file")
    }
}
