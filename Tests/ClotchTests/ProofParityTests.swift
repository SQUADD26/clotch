// figma: 78-62682
import XCTest
import SwiftUI
@testable import Clotch

/// Parità col disegno Figma (claude-config#1942): disegna il riquadro «Prova da confermare» a scala 1 nei due frame
/// (508 × 47 su nero, come il contenuto del notch) e scrive i PNG da confrontare:
///
///     FIGMA_PARITA_DIR=$PWD/design/app swift test --filter ProofParityTests
///     node ~/.claude/skills/figma-ui-design/parita.mjs immagine design/figma/78-62682.png design/app/78-62682.png --soglia 0.08
///
/// Su richiesta, come la galleria: senza FIGMA_PARITA_DIR il test si salta.
@MainActor
final class ProofParityTests: XCTestCase {
    private func render(_ box: GoalProofBox, as id: String) throws {
        guard let dir = ProcessInfo.processInfo.environment["FIGMA_PARITA_DIR"] else {
            throw XCTSkip("FIGMA_PARITA_DIR not set — parity render is opt-in")
        }
        let frame = box.frame(width: 508).background(Color.black).environment(\.colorScheme, .dark)
        let image = try XCTUnwrap(OffscreenRender.rasterize(frame, scale: 1))
        XCTAssertEqual(image.width, 508)
        XCTAssertEqual(image.height, 47)
        try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        try OffscreenRender.writePNG(image, to: dir + "/\(id).png")
    }

    func testWaitingBoxMatchesFigmaFrame() throws {
        try render(GoalProofBox(text: "Prova dal vivo: il notch si apre e si legge intero"), as: "78-62682")
    }

    func testFailedBoxMatchesFigmaFrame() throws {
        try render(GoalProofBox(text: "", failure: "Non riesco a scrivere il file dell’obiettivo."), as: "78-62810")
    }
}
