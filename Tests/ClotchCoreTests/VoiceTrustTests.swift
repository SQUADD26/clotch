import XCTest
@testable import ClotchCore

final class VoiceTrustCoreTests: XCTestCase {
    func testVerdictBands() {
        XCTAssertEqual(VoiceTrust.verdict(distance: 0.2, seconds: 3), .yes)
        XCTAssertEqual(VoiceTrust.verdict(distance: 0.45, seconds: 3), .uncertain)
        XCTAssertEqual(VoiceTrust.verdict(distance: 0.7, seconds: 3), .no)
        XCTAssertEqual(VoiceTrust.verdict(distance: 0.1, seconds: 0.8), .uncertain, "too little sound is never yes")
        XCTAssertEqual(VoiceTrust.verdict(distance: .infinity, seconds: 5), .uncertain)
    }

    func testOnlyAllThreeAccept() {
        XCTAssertTrue(VoiceTrust.accepted(fromKey: true, unlocked: true, verdict: .yes))
        for (k, u, v) in [(false, true, VoiceTrust.Verdict.yes), (true, false, .yes), (true, true, .uncertain), (true, true, .no)] {
            XCTAssertFalse(VoiceTrust.accepted(fromKey: k, unlocked: u, verdict: v))
        }
    }

    func testRiskyOrdersAreFlaggedRisky() {
        for t in ["Elimina la cartella clienti", "Fai il deploy in produzione", "Paga la fattura di Marco", "Manda una mail a Giulia", "Scrivi a Marco su WhatsApp"] {
            XCTAssertTrue(VoiceTrust.isRisky(t), t)
        }
        for t in ["Controlla le sessioni aperte", "A che punto siamo con la richiesta", "Apri la scheda di oggi"] {
            XCTAssertFalse(VoiceTrust.isRisky(t), t)
        }
    }

    func testStoreIsPrivateAndPayloadHasNoPrint() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("imp-\(UUID().uuidString)/p.json")
        let s = VoiceTrust.Store(url: url)
        try s.save([[1, 2], [3, 4]])
        XCTAssertEqual(s.load, [[1, 2], [3, 4]])
        XCTAssertEqual(try FileManager.default.attributesOfItem(atPath: url.path)[.posixPermissions] as? Int, 0o600)
        s.erase(); XCTAssertFalse(s.exists)
        let p = VoiceTrust.payload(verdict: .yes, distance: 0.12345, fromKey: true, unlocked: true, risky: false)
        XCTAssertEqual(Set(p.keys), ["esito", "distanza", "tasto", "sbloccato", "rischiosa"])
    }

    func testConsistentNeedsThreeAlikePhrases() {
        XCTAssertTrue(VoiceTrust.consistent([[1, 0], [1, 0.05], [1, 0.1]]))
        XCTAssertFalse(VoiceTrust.consistent([[1, 0], [1, 0.05]]))
        XCTAssertFalse(VoiceTrust.consistent([[1, 0], [1, 0.05], [0, 1]]))
    }
}
