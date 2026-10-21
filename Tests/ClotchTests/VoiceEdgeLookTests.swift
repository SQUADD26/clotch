import XCTest
import SwiftUI
@testable import Clotch

final class VoiceEdgeLookTests: XCTestCase {
    func testColoursLoopWithoutSeam() {
        XCTAssertEqual(VoiceEdgeLook.color(0), VoiceEdgeLook.color(1))
        XCTAssertEqual(VoiceEdgeLook.color(0.25), VoiceEdgeLook.color(-0.75)) // phase subtracted past zero
        XCTAssertNotEqual(VoiceEdgeLook.color(0), VoiceEdgeLook.color(0.5))
    }
}
