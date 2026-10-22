import XCTest
@testable import Clotch
import ClotchCore

/// #147: not speaking is Roberto's choice, never an error. The pill folds away without red and without buttons.
@MainActor
final class VoiceInputSilenceTests: XCTestCase {
    func testNothingSaidClosesThePillQuietly() async {
        let c = VoiceInputController.still(.finishing)
        await c.route("  \n ", run: c.run)
        XCTAssertEqual(c.phase, .idle)
        XCTAssertEqual(c.light, .off)
    }
}
