import XCTest
@testable import ClotchCore

/// #262: what Roberto is told about an order comes from the engine's `ingresso/.esiti/<name>.json` (ingresso_voce.py #2105), never from the
/// file vanishing or from the model's words. Fixture `esito-ingresso.json` is the engine's own (claude-config `contratto-clotch/`); the other states are it with `stato` changed.
final class VoiceDeliveryTests: XCTestCase {
    private func fixture(_ name: String) throws -> Data {
        let dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
        return try Data(contentsOf: dir.appendingPathComponent("Fixtures/motore/\(name)"))
    }

    private func esito(_ stato: String) throws -> Data {
        var d = try XCTUnwrap(JSONSerialization.jsonObject(with: fixture("esito-ingresso.json")) as? [String: Any])
        d["stato"] = stato
        return try JSONSerialization.data(withJSONObject: d)
    }

    func testTheEnginesThreeStates() throws {
        XCTAssertEqual(try VoiceRoute.delivery(esiti: [fixture("esito-ingresso.json")]), .delivered, "the engine's own file is consegnato")
        XCTAssertEqual(VoiceRoute.delivery(esiti: [try esito("non_consegnato")]), .notDelivered)
        XCTAssertEqual(VoiceRoute.delivery(esiti: [try esito("in_consegna")]), .unproven)
    }

    func testNoEsitoOrAnUnreadableOneProvesNothing() {
        XCTAssertEqual(VoiceRoute.delivery(esiti: []), .unproven, "file gone from the inbox = only taken")
        XCTAssertEqual(VoiceRoute.delivery(esiti: [Data("ricevuto".utf8)]), .unproven, "the model's words are not an esito")
        XCTAssertEqual(VoiceRoute.delivery(esiti: [Data(#"{"stato":"ricevuto"}"#.utf8)]), .unproven)
    }

    /// An order with several esiti (the helper may pass more than one): one not delivered is enough to say so; delivered needs all.
    func testManyEsiti() throws {
        let ok = try esito("consegnato"), no = try esito("non_consegnato"), wait = try esito("in_consegna")
        XCTAssertEqual(VoiceRoute.delivery(esiti: [ok, ok]), .delivered)
        XCTAssertEqual(VoiceRoute.delivery(esiti: [ok, no]), .notDelivered)
        XCTAssertEqual(VoiceRoute.delivery(esiti: [ok, wait]), .unproven)
    }
}
