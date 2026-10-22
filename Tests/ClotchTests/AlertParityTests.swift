// figma: 78-61703
import XCTest
import SwiftUI
import ClotchCore
@testable import Clotch

/// Parità col disegno Figma (#235, #236): la riga sotto il notch (78-61703, errore 78-61932) e gli avvisi in cima al notch aperto
/// (78-62207), a scala 1 sul nero del notch:
///
///     FIGMA_PARITA_DIR=$PWD/design/app swift test --filter AlertParityTests
///     node ~/.claude/skills/figma-ui-design/parita.mjs immagine design/figma/78-61703.png design/app/78-61703.png --soglia 0.08
///
/// Su richiesta: senza FIGMA_PARITA_DIR il test si salta.
@MainActor
final class AlertParityTests: XCTestCase {
    private func event(_ json: String) throws -> VoiceEvent { try XCTUnwrap(VoiceEvents.parse(line: Substring(json))) }

    private var ok: VoiceEvent {
        get throws { try event(#"{"v": 1, "id": "e-1", "t": 1792670000, "tipo": "aspetta_ok", "livello": "alto", "soggetto": "Setup", "testo": "Setup aspetta un tuo ok per scegliere come fare i test della pagina prezzi: vuoi che glielo dia io?", "prova": "local_abc"}"#) }
    }
    private var stalled: VoiceEvent {
        get throws { try event(#"{"v": 1, "id": "e-2", "t": 1792670000, "tipo": "dipendenza_ferma", "livello": "alto", "sessione": {"cli": "c", "local_id": "local_x", "titolo": "", "ruolo": ""}, "soggetto": "SEO", "testo": "Una sessione aspetta te da troppo: il motore si è fermato: serve una persona.", "prova": "D-1"}"#) }
    }

    private func save<V: View>(_ view: V, _ w: CGFloat, _ h: CGFloat, _ id: String) throws {
        guard let dir = ProcessInfo.processInfo.environment["FIGMA_PARITA_DIR"] else {
            throw XCTSkip("FIGMA_PARITA_DIR not set — parity render is opt-in")
        }
        let frame = view.frame(width: w, height: h, alignment: .topLeading).background(Color.black).environment(\.colorScheme, .dark)
        let image = try XCTUnwrap(OffscreenRender.rasterize(frame, scale: 1))
        XCTAssertEqual([image.width, image.height], [Int(w), Int(h)])
        try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        try OffscreenRender.writePNG(image, to: dir + "/\(id).png")
    }

    func testNoteMatchesFigma() throws {
        try save(NotchAlertNote(event: ok, state: .shown), 440, 88, "78-61703")
    }

    func testFailedNoteMatchesFigma() throws {
        try save(NotchAlertNote(event: ok, state: .failed("La chat di Setup non si è aperta: l’app Claude è chiusa.")), 440, 89, "78-61932")
    }

    func testInboxMatchesFigma() throws {
        try save(NotchAlertInbox(items: [ok, stalled], sending: nil, failed: nil), 508, 106, "78-62207")
    }
}
