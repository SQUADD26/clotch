import XCTest
@testable import ClotchCore

/// #38: the «Voce» settings page keeps config.json's unknown fields, writes the key 600; the prompt and the pronunciation list are the config's files (#84).
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

    func testMaskedShowsOnlyTheTail() throws {
        XCTAssertNil(files.masked(files.keyURL))
        try files.saveKey("sk_abcdefgh3f9a")
        XCTAssertEqual(files.masked(files.keyURL), "••••••••••••3f9a")
    }

    func testOwnPromptWinsAndResets() throws {
        try put("Sei la voce.\n", files.promptURL)
        try files.savePrompt("  Parla piano.  ")
        XCTAssertEqual(files.prompt, "Parla piano.")
        XCTAssertTrue(files.hasOwnPrompt)
        XCTAssertEqual(try mode(files.ownPromptURL), 0o600)
        try files.savePrompt("Sei la voce.")  // the config's own text: no copy kept
        XCTAssertFalse(files.hasOwnPrompt)
        try files.savePrompt("Altro.")
        try files.resetPrompt()
        XCTAssertEqual(files.prompt, "Sei la voce.")
        XCTAssertFalse(FileManager.default.fileExists(atPath: files.ownPromptURL.path))
    }

    func testPromptIsTheConfigFile() throws {
        XCTAssertNil(files.prompt, "no config file: silence, no stock copy")
        XCTAssertEqual(files.promptURL.path, home.appendingPathComponent(".claude/mods/clean-view/hooks/voce-parlatore.md").path)
        try put("  \n", files.promptURL)
        XCTAssertNil(files.prompt)
        try put("Sei la voce.\n", files.promptURL)
        XCTAssertEqual(files.prompt, "Sei la voce.")
    }

    func testEngineFilesComeFromTheEngineFolder() throws {
        // #251 (claude-config#1998): the engine's copy wins; without it, the old mod folder still works
        try put("Dal motore.\n", home.appendingPathComponent(".claude/hooks/voce-parlatore.md"))
        try put(#"{"PR": "pi erre"}"#, home.appendingPathComponent(".claude/hooks/voce-pronuncia.json"))
        try put("Dalla mod.\n", home.appendingPathComponent(".claude/mods/clean-view/hooks/voce-parlatore.md"))
        let f = VoiceFiles(home: home)
        XCTAssertEqual(f.promptURL.path, home.appendingPathComponent(".claude/hooks/voce-parlatore.md").path)
        XCTAssertEqual(f.prompt, "Dal motore.")
        XCTAssertEqual(f.pronunciation, ["PR": "pi erre"])
    }

    func testPronunciationIsBaseListThenOwnFile() throws {
        XCTAssertEqual(files.pronunciation, [:])
        try put(#"{"Clotch": "Clocc", "PR": "pi erre"}"#, files.basePronunciationURL)
        try put(#"{"PR": "richiesta", "notch": "nocc"}"#, files.pronunciationURL)
        XCTAssertEqual(files.pronunciation, ["Clotch": "Clocc", "PR": "richiesta", "notch": "nocc"])
        XCTAssertEqual(files.pronunciationURL.path, home.appendingPathComponent(".config/voce/pronuncia.json").path)
        try put("non json", files.pronunciationURL)
        XCTAssertEqual(files.pronunciation, ["Clotch": "Clocc", "PR": "pi erre"])
        try put(#"{"API": "èi pi ài", "n": 3}"#, files.pronunciationURL)
        XCTAssertEqual(files.pronunciation, ["Clotch": "Clocc", "PR": "pi erre", "API": "èi pi ài"], "an entry that is not text is skipped")
    }

    func testJudgeQuestionIsTheConfigFile() throws {
        XCTAssertNil(files.judgeQuestion, "no config file: the judge is not asked")
        XCTAssertEqual(files.judgeQuestionURL.path, home.appendingPathComponent(".claude/hooks/voce_giudice_domanda.txt").path)
        try put("E' necessario avvisare l'utente adesso?\n", files.judgeQuestionURL)
        XCTAssertEqual(files.judgeQuestion, "E' necessario avvisare l'utente adesso?")
    }
}
