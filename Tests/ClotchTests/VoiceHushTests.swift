import XCTest
@testable import Clotch

/// clotch#456: the engine's «zitto» (`com.squadd.clotch.interrompi-voce`) stops the listening; what is waiting to be sent stays.
@MainActor
final class VoiceHushTests: XCTestCase {
    func testSignalStopsTheListening() async {
        let center = NotificationCenter()
        let c = VoiceInputController.still(.listening)
        c.listenForHush(on: center)
        center.post(name: VoiceInputController.hushName, object: nil)
        await waitUntil("the listening should stop on the signal") { c.phase == .idle }
    }

    func testHushLeavesAnOrderWaitingForAnnulla() {
        let c = VoiceInputController.still(.sending)
        c.hush()
        XCTAssertEqual(c.phase, .sending)
    }

    func testNameIsTheOneTheEnginePosts() {
        XCTAssertEqual(VoiceInputController.hushName.rawValue, "com.squadd.clotch.interrompi-voce")
    }
}
