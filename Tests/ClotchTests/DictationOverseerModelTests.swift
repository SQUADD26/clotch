import XCTest
import ClotchCore
@testable import Clotch

/// clotch#286: the «Modello Friday» picker saves its choice under `overseer_modello`, and `VoiceInput.Config` reads it back.
final class DictationOverseerModelTests: XCTestCase {
    func testChoiceIsWrittenUnderOverseerModello() throws {
        var config = VoiceInput.Config([:])
        XCTAssertEqual(config.overseerModel, "claude-haiku-5-5")
        config.overseerModel = "claude-opus-5-5"
        let changes = DictationPage.changes(config)
        XCTAssertEqual(changes["overseer_modello"] as? String, "claude-opus-5-5")
        XCTAssertEqual(VoiceInput.Config(changes).overseerModel, "claude-opus-5-5")
    }
}
