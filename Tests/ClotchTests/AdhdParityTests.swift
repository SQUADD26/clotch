import XCTest
import SwiftUI
@testable import Clotch

/// Parità col disegno Figma (claude-config#1942, punto 8): disegna AdhdQuestionRow a scala 1 sul nero del notch,
/// stessa misura del nodo 42-48321 (508 × 54), e scrive il PNG da confrontare con design/figma/42-48321.png:
///
///     FIGMA_PARITA_DIR=$PWD/design/app swift test --filter AdhdParityTests
///     node ~/.claude/skills/figma-ui-design/parita.mjs immagine design/figma/42-48321.png design/app/42-48321.png --soglia 0.08
///
/// Su richiesta, come la galleria: senza FIGMA_PARITA_DIR il test si salta.
@MainActor
final class AdhdParityTests: XCTestCase {
    func testRowMatchesFigmaFrame() throws {
        guard let dir = ProcessInfo.processInfo.environment["FIGMA_PARITA_DIR"] else {
            throw XCTSkip("FIGMA_PARITA_DIR not set — parity render is opt-in")
        }
        let row = AdhdQuestionRow(question: "Come riavvio il notch se si blocca?",
                                  detail: "Chiesta 3 volte · ieri · a Clotch: correzioni notch")
            .frame(width: 508, height: 54)
            .background(Color.black)
            .environment(\.colorScheme, .dark)
        let image = try XCTUnwrap(OffscreenRender.rasterize(row, scale: 1))
        XCTAssertEqual(image.width, 508)
        XCTAssertEqual(image.height, 54)
        try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        try OffscreenRender.writePNG(image, to: dir + "/42-48321.png")
    }
}
