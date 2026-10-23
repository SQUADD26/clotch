// figma: 94-66178
import XCTest
import SwiftUI
import ClotchCore
@testable import Clotch

/// Parità col disegno Figma (claude-config#1942): disegna la riga dell'avviso schermo a scala 1 (458 × 42, nera) e scrive i PNG
/// da confrontare con i frame 94-66178 (In arrivo, 1,5 s) e 94-66186 (Finito):
///
///     FIGMA_PARITA_DIR=$PWD/design/app swift test --filter ScreenNoticeParityTests
///     node ~/.claude/skills/figma-ui-design/parita.mjs immagine design/figma/94-66178.png design/app/94-66178.png --soglia 0.08
///
/// Su richiesta: senza FIGMA_PARITA_DIR il test si salta.
@MainActor
final class ScreenNoticeParityTests: XCTestCase {
    private func render(_ phase: ScreenNotice.Phase, still: Date, to name: String) throws {
        guard let dir = ProcessInfo.processInfo.environment["FIGMA_PARITA_DIR"] else { throw XCTSkip("FIGMA_PARITA_DIR not set — parity render is opt-in") }
        let frame = ScreenNoticePill(phase: phase, still: still)
            .frame(width: ScreenNoticePill.width, height: FigmaToken.MacOS27GoldenGate.notchSpazio42, alignment: .topLeading)
            .background(Color.black)
            .environment(\.colorScheme, .dark)
        let image = try XCTUnwrap(OffscreenRender.rasterize(frame, scale: 1))
        XCTAssertEqual(image.width, 458)
        XCTAssertEqual(image.height, 42)
        try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        try OffscreenRender.writePNG(image, to: dir + "/" + name + ".png")
    }

    func testIncomingMatchesFigmaFrame() throws {
        let now = Date()
        try render(.incoming(deadline: now.addingTimeInterval(1.5), total: 1.5), still: now, to: "94-66178")
    }

    func testFreeMatchesFigmaFrame() throws {
        try render(.free(until: Date().addingTimeInterval(1.2)), still: Date(), to: "94-66186")
    }

    func testCounterSteps() {
        XCTAssertEqual(ScreenNoticePill.counter(1.5), "1,5 s")
        XCTAssertEqual(ScreenNoticePill.counter(0.81), "0,9 s", "rounded up: the last step reads 0,1 s")
        XCTAssertEqual(ScreenNoticePill.counter(0.02), "0,1 s")
        XCTAssertEqual(ScreenNoticePill.counter(0), "0,0 s")
    }
}
