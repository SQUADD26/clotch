import XCTest
@testable import CodeIslandCore

final class NotchIslandTests: XCTestCase {
    /// The open animation, frame by frame: from the closed bar (370 × 32) to the open notch (620 × 400).
    func testTopAndCentreStayStillAtEveryStep() {
        let window = CGRect(x: 0, y: 0, width: 620, height: 900)
        for i in 0...20 {
            let t = CGFloat(i) / 20
            let island = CGRect(x: 0, y: 0, width: window.width, height: 32 + (400 - 32) * t)
            let column = NotchIslandGeometry.column(in: island, width: 370 + (620 - 370) * t)
            XCTAssertEqual(column.minY, 0, "step \(i)")
            XCTAssertEqual(column.midX, window.midX, accuracy: 0.001, "step \(i)")
            XCTAssertEqual(column.height, island.height, "step \(i)")
        }
    }

    func testWiderThanTheWindowStaysCentred() {  // the idle indicator can outgrow the window
        let column = NotchIslandGeometry.column(in: CGRect(x: 0, y: 0, width: 300, height: 32), width: 340)
        XCTAssertEqual(column.minX, -20)
        XCTAssertEqual(column.midX, 150)
    }
}
