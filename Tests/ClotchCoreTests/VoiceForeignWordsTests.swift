import XCTest
@testable import ClotchCore

/// #323: English words inside an Italian line are respelled so the voice does not read them with a French accent.
final class VoiceForeignWordsTests: XCTestCase {
    private func body(_ text: String, _ own: [String: String] = [:]) throws -> [String: Any] {
        let r = VoiceTurn.speechRequest(text: text, config: .init([:]), key: "k",
                                        pronunciation: VoiceTurn.builtInPronunciation.merging(own) { _, o in o }, foreign: VoiceTurn.foreignRespelling)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(r.httpBody)) as? [String: Any])
    }
    private func said(_ t: String, _ own: [String: String] = [:]) throws -> String { try XCTUnwrap(body(t, own)["text"] as? String) }

    func testWordAtStartAndEnd() throws {
        XCTAssertEqual(try said("Friday ha finito il deploy"), "Fraidèi ha finito il diplòi")
        XCTAssertEqual(try said("Ho fatto il merge"), "Ho fatto il mèrgi")
    }

    func testTwoForeignWordsNextToEachOther() throws {
        XCTAssertEqual(try said("Il deploy merge è pronto, push branch fatto"), "Il diplòi mèrgi è pronto, pusc brànci fatto")
    }

    func testOverseerBecomesFridaySpokenInEnglishSound() throws {
        XCTAssertEqual(try said("Overseer non gira"), "Fraidèi non gira")
    }

    func testItalianNamesAndWordsDoNotChange() throws {
        let t = "Roberto e Marco vanno a Torino, il filetto è buono"
        XCTAssertEqual(try said(t), t)
    }

    func testCaseAndNoMidWordReplacement() throws {
        XCTAssertEqual(try said("DEPLOY e Deploy"), "diplòi e diplòi")
        XCTAssertEqual(try said("debugging, pushed, buildings, profile"), "debugging, pushed, buildings, profile")
    }

    func testRobertoFileHasTheLastWord() throws {
        XCTAssertEqual(try said("il deploy", ["deploy": "rilascio"]), "il rilascio")
    }

    func testLongLineKeepsAllWordsAndLanguageAndVoice() throws {
        let line = String(repeating: "Il deploy di Friday è pronto. ", count: 12)
        let b = try body(VoiceTurn.cut(line, 320))
        let t = try XCTUnwrap(b["text"] as? String)
        XCTAssertFalse(t.contains("deploy") || t.contains("Friday"), t)
        XCTAssertEqual(b["language_code"] as? String, "it")
        XCTAssertEqual(b["model_id"] as? String, VoiceFiles.defaultModel)
    }

    /// The 5 sample lines for the audio check on the Mac: prints the whole request body.
    func testPrintSampleRequestBodies() throws {
        for l in ["Friday ha aperto il branch giusto", "Ho fatto il deploy e poi il merge", "Overseer aspetta un tuo sì sul commit",
                  "Il token è scaduto, serve un nuovo push", "Roberto, a Torino il build di Friday è pronto"] {
            let r = VoiceTurn.speechRequest(text: l, config: .init([:]), key: "k", pronunciation: VoiceTurn.builtInPronunciation, foreign: VoiceTurn.foreignRespelling)
            var o = try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(r.httpBody)) as? [String: Any])
            o["voice_id"] = r.url?.lastPathComponent.components(separatedBy: "?").first
            print("SAMPLE-BODY", String(decoding: try JSONSerialization.data(withJSONObject: o, options: .sortedKeys), as: UTF8.self))
        }
    }
}
