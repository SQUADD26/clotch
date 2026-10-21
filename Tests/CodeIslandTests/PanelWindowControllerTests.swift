import AppKit
import XCTest
@testable import CodeIsland

final class PanelWindowControllerTests: XCTestCase {
    func testScreenHopIsAQuickFadeOutThenFadeIn() {
        let motion = PanelWindowController.screenHopMotion()

        XCTAssertEqual(motion.outgoingOffset, 0)
        XCTAssertEqual(motion.incomingOffset, 0)
        XCTAssertEqual(motion.fadeOutDuration, 0.08, accuracy: 0.001)
        XCTAssertEqual(motion.incomingPauseDuration, 0, accuracy: 0.001)
        XCTAssertEqual(motion.fadeInDuration, 0.18, accuracy: 0.001)
    }

    func testScreenHopFramesStayOnTheirOwnScreens() {
        let oldFrame = NSRect(x: 100, y: 820, width: 420, height: 180)
        let newFrame = NSRect(x: 1800, y: 900, width: 420, height: 180)

        let frames = PanelWindowController.screenHopFrames(
            oldFrame: oldFrame,
            newFrame: newFrame
        )

        XCTAssertEqual(frames.outgoing.origin.x, oldFrame.origin.x)
        XCTAssertEqual(frames.outgoing.origin.y, oldFrame.origin.y)
        XCTAssertEqual(frames.outgoing.size, oldFrame.size)

        XCTAssertEqual(frames.incoming.origin.x, newFrame.origin.x)
        XCTAssertEqual(frames.incoming.origin.y, newFrame.origin.y)
        XCTAssertEqual(frames.incoming.size, newFrame.size)
    }
}
