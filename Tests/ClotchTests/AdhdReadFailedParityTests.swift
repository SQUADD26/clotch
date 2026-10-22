// figma: 78-62944
import XCTest
import SwiftUI
import ClotchCore
@testable import Clotch

/// Parità col disegno Figma (claude-config#1942): disegna «Lettura non riuscita» a scala 1 nella cornice del frame 78-62944
/// (508 × 83) col testo d'esempio del disegno. Sfondo trasparente come l'export di Figma (il notch è nero dietro):
///
///     FIGMA_PARITA_DIR=$PWD/design/app swift test --filter ClotchTests.AdhdReadFailedParityTests
///     node ~/.claude/skills/figma-ui-design/parita.mjs immagine design/figma/78-62944.png design/app/78-62944.png --soglia 0.08
///
/// Su richiesta: senza FIGMA_PARITA_DIR il test si salta.
@MainActor
final class AdhdReadFailedParityTests: XCTestCase {
    func testViewMatchesFigmaFrame() throws {
        guard let dir = ProcessInfo.processInfo.environment["FIGMA_PARITA_DIR"] else {
            throw XCTSkip("FIGMA_PARITA_DIR not set — parity render is opt-in")
        }
        let example = "Il comando delle richieste è uscito con errore 1: «richieste.py: file non trovato». Riprova tra poco."
        let frame = AdhdReadFailed(error: example)
            .frame(width: 508, height: 83, alignment: .topLeading)
            .environment(\.colorScheme, .dark)
        let image = try XCTUnwrap(OffscreenRender.rasterize(frame, scale: 1))
        XCTAssertEqual(image.width, 508)
        XCTAssertEqual(image.height, 83)
        try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        try OffscreenRender.writePNG(image, to: dir + "/78-62944.png")
    }
}
