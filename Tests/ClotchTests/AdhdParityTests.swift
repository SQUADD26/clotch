// figma: 78-62299
import XCTest
import SwiftUI
import ClotchCore
@testable import Clotch

/// Parità col disegno Figma (claude-config#1942): disegna la scheda ADHD a scala 1 nella cornice dei frame 78-62299 (riga aperta),
/// 78-62538 (risposta rimossa) e 78-62856 (lettura non riuscita), larghi 578 (il notch è nero in entrambi i temi), e scrive i PNG da confrontare:
///
///     FIGMA_PARITA_DIR=$PWD/design/app swift test --filter AdhdParityTests
///     node ~/.claude/skills/figma-ui-design/parita.mjs immagine design/figma/78-62299.png design/app/78-62299.png --soglia 0.08
///
/// Su richiesta, come la galleria: senza FIGMA_PARITA_DIR il test si salta. Lo store è di prova: nessun comando vero parte.
@MainActor
final class AdhdParityTests: XCTestCase {
    private typealias T = FigmaToken.MacOS27GoldenGate

    private func store() -> AdhdStore {
        let store = AdhdStore(run: { _ in .success(Data("[]".utf8)) })
        store.items = AdhdRequest.samples
        return store
    }

    private func render(_ id: String, height: CGFloat, count: Int, _ store: AdhdStore, items: [AdhdRequest]? = nil) throws {
        guard let dir = ProcessInfo.processInfo.environment["FIGMA_PARITA_DIR"] else {
            throw XCTSkip("FIGMA_PARITA_DIR not set — parity render is opt-in")
        }
        let frame = VStack(alignment: .leading, spacing: T.notchSpazio18) {
            TabBar(tab: .constant(.adhd), adhdCount: count, afkOn: false)
                .frame(height: T.notchMisura30 + 8)  // the frame's well: 30 tab + 4 + 4; the gear and moon sit inside it
            AdhdTab(items: items ?? store.items, store: store)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, T.notchSpazio35).padding(.top, T.notchSpazio42).padding(.bottom, T.notchSpazio26)
        .frame(width: T.notchMisura578, height: height, alignment: .topLeading)
        .background(Color.black)
        .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: T.notchRaggio40, bottomTrailingRadius: T.notchRaggio40))
        .environment(\.colorScheme, .dark)
        let image = try XCTUnwrap(OffscreenRender.rasterize(frame, scale: 1))
        XCTAssertEqual(image.width, 578)
        XCTAssertEqual(image.height, Int(height))
        try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        try OffscreenRender.writePNG(image, to: dir + "/" + id + ".png")
    }

    func testOpenRowMatchesFigmaFrame() throws {
        let store = store()
        store.show(question: "Dove vedo i miei commenti su Figma?")
        try render("78-62299", height: 457, count: store.unanswered, store)
    }

    func testRemovedAnswerMatchesFigmaFrame() throws {
        let store = store()
        store.markRead("Q-3")
        try render("78-62538", height: 389, count: store.unanswered, store)
    }

    func testFailedReadMatchesFigmaFrame() throws {
        let store = store()
        store.failure = .exit(1, stderr: "richieste.py: file non trovato")
        try render("78-62856", height: 207, count: 0, store, items: [])
    }
}
