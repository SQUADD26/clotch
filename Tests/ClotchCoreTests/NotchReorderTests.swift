import XCTest
@testable import ClotchCore

final class NotchReorderTests: XCTestCase {
    // Three zones 200 wide at y 0…40, 8 apart; the palette below.
    private func zones(_ items: [[CGFloat]]) -> [(frame: CGRect, items: [CGRect])] {
        items.enumerated().map { i, xs in
            (CGRect(x: CGFloat(i) * 208, y: 0, width: 200, height: 40), xs.map { CGRect(x: $0, y: 7, width: 40, height: 26) })
        }
    }
    private let palette = CGRect(x: 0, y: 100, width: 616, height: 200)

    func testInsideAZoneTheMiddlesGiveTheSlot() {
        let z = zones([[40, 90, 140], [], []])  // middles 60, 110, 160
        XCTAssertEqual(NotchReorder.drop(at: CGPoint(x: 10, y: 20), zones: z, palette: palette), .slot(zone: 0, index: 0))
        XCTAssertEqual(NotchReorder.drop(at: CGPoint(x: 61, y: 20), zones: z, palette: palette), .slot(zone: 0, index: 1))
        XCTAssertEqual(NotchReorder.drop(at: CGPoint(x: 120, y: 20), zones: z, palette: palette), .slot(zone: 0, index: 2))
        XCTAssertEqual(NotchReorder.drop(at: CGPoint(x: 199, y: 20), zones: z, palette: palette), .slot(zone: 0, index: 3))
    }

    func testAnotherZoneAndTheGapBetween() {
        let z = zones([[80], [288], [500]])
        XCTAssertEqual(NotchReorder.drop(at: CGPoint(x: 300, y: 20), zones: z, palette: palette), .slot(zone: 1, index: 0))
        XCTAssertEqual(NotchReorder.drop(at: CGPoint(x: 600, y: 20), zones: z, palette: palette), .slot(zone: 2, index: 1))
        // In the 8-point gap: the nearer zone, never a cancel.
        XCTAssertEqual(NotchReorder.drop(at: CGPoint(x: 201, y: 20), zones: z, palette: palette), .slot(zone: 0, index: 1))
        XCTAssertEqual(NotchReorder.drop(at: CGPoint(x: 207, y: 20), zones: z, palette: palette), .slot(zone: 1, index: 0))
        // A little above or below the zones still counts.
        XCTAssertEqual(NotchReorder.drop(at: CGPoint(x: 300, y: -20), zones: z, palette: palette), .slot(zone: 1, index: 0))
    }

    func testAnEmptyZoneTakesItAtTheStart() {
        XCTAssertEqual(NotchReorder.drop(at: CGPoint(x: 500, y: 20), zones: zones([[], [], []]), palette: palette), .slot(zone: 2, index: 0))
    }

    func testPaletteRemovesAndOutsideCancels() {
        let z = zones([[40], [], []])
        XCTAssertEqual(NotchReorder.drop(at: CGPoint(x: 300, y: 200), zones: z, palette: palette), .remove)
        XCTAssertEqual(NotchReorder.drop(at: CGPoint(x: 300, y: 70), zones: z, palette: palette), .cancel)
        XCTAssertEqual(NotchReorder.drop(at: CGPoint(x: 700, y: 20), zones: z, palette: palette), .cancel)
        XCTAssertEqual(NotchReorder.drop(at: CGPoint(x: 300, y: 70), zones: z, palette: nil), .cancel)
    }

    func testNoZonesOnlyPaletteOrCancel() {
        XCTAssertEqual(NotchReorder.drop(at: CGPoint(x: 10, y: 20), zones: [], palette: palette), .cancel)
        XCTAssertEqual(NotchReorder.drop(at: CGPoint(x: 10, y: 150), zones: [], palette: palette), .remove)
    }
}
