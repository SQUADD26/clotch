// figma: 58-56113
import XCTest
import SwiftUI
import ClotchCore
@testable import Clotch

/// Parità col disegno Figma (claude-config#1942): disegna la scheda ADHD a scala 1 nella cornice del frame 58-56113
/// (578 × 402, identico a 58-56176: il notch è nero in entrambi i temi) e scrive il PNG da confrontare:
///
///     FIGMA_PARITA_DIR=$PWD/design/app swift test --filter AdhdParityTests
///     node ~/.claude/skills/figma-ui-design/parita.mjs immagine design/figma/58-56113.png design/app/58-56113.png --soglia 0.08
///
/// Su richiesta, come la galleria: senza FIGMA_PARITA_DIR il test si salta.
@MainActor
final class AdhdParityTests: XCTestCase {
    private typealias T = FigmaToken.MacOS27GoldenGate

    func testTabMatchesFigmaFrame() throws {
        guard let dir = ProcessInfo.processInfo.environment["FIGMA_PARITA_DIR"] else {
            throw XCTSkip("FIGMA_PARITA_DIR not set — parity render is opt-in")
        }
        let frame = VStack(alignment: .leading, spacing: T.notchSpazio18) {
            TabBar(tab: .constant(.adhd), adhdCount: AdhdRequest.unansweredCount(AdhdRequest.samples), afkOn: false)
                .frame(height: T.notchMisura30 + 8)  // the frame's well: 30 tab + 4 + 4; the gear and moon sit inside it
            AdhdTab(items: AdhdRequest.samples)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, T.notchSpazio35).padding(.top, T.notchSpazio42).padding(.bottom, T.notchSpazio26)
        .frame(width: T.notchMisura578, height: 402, alignment: .topLeading)
        .background(Color.black)
        .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: T.notchRaggio40, bottomTrailingRadius: T.notchRaggio40))
        .environment(\.colorScheme, .dark)
        let image = try XCTUnwrap(OffscreenRender.rasterize(frame, scale: 1))
        XCTAssertEqual(image.width, 578)
        XCTAssertEqual(image.height, 402)
        try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        try OffscreenRender.writePNG(image, to: dir + "/58-56113.png")
    }
}
