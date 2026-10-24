import XCTest
@testable import Clotch
import ClotchCore

/// Live proof against the real engine on this Mac (clotch#1110): the notch's door writes one `parla` and the registry answers. Skipped without CLOTCH_LIVE.
@MainActor
final class FridayLiveTests: XCTestCase {
    func testParlaReachesTheEngine() async throws {
        guard ProcessInfo.processInfo.environment["CLOTCH_LIVE"] != nil else { throw XCTSkip("CLOTCH_LIVE not set") }
        let out = await FridayDelivery.send("Prova del collegamento del notch, nessuna azione: rispondi solo che hai ricevuto.", receiptWait: 60, answerWait: 60)
        print("LIVE outcome: \(out)")
        XCTAssertNotEqual(out, .notReached)
    }
}
