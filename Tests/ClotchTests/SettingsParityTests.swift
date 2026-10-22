// figma: 91-64184
import XCTest
import SwiftUI
import AVFoundation
import ClotchCore
@testable import Clotch

/// Parità col disegno Figma (claude-config#1942): disegna Dettatura e Voce a scala 1 nella misura del frame «Contenuto» (678 ×
/// 817 e 678 × 1441, chiaro e scuro) con lo stato che mostra il disegno, e scrive i PNG da confrontare:
///
///     FIGMA_PARITA_DIR=$PWD/design/app swift test --filter SettingsParityTests
///     node ~/.claude/skills/figma-ui-design/parita.mjs immagine design/figma/91-64184.png design/app/91-64184.png --soglia 0.08
///
/// Su richiesta: senza FIGMA_PARITA_DIR il test si salta. La casa del Mac è una cartella temporanea: nessun file vero viene letto.
@MainActor
final class SettingsParityTests: XCTestCase {
    private typealias T = FigmaToken.MacOS27GoldenGate

    private func home(engine: String) throws -> URL {
        let home = FileManager.default.temporaryDirectory.appendingPathComponent("parita-\(UUID().uuidString)")
        let voce = home.appendingPathComponent(".config/voce")
        try FileManager.default.createDirectory(at: voce, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: home.appendingPathComponent(".config/elevenlabs"), withIntermediateDirectories: true)
        let config: [String: Any] = ["ingresso_motore": engine, "ingresso_lingua": "auto", "ingresso_modo": "hold", "ingresso_acceso": true,
                                     "ingresso_a_voce": true, "parla_per": "tutte", "abbassa_audio": true, "model_id": "eleven_flash_v2_5",
                                     "speed": 1.3, "tetto_chiamate": 200, "tetto_caratteri": 20000, "riscrittore_modello": "claude-haiku-5-5",
                                     "riscrittore_ragionamento": "low"]
        try JSONSerialization.data(withJSONObject: config).write(to: voce.appendingPathComponent("config.json"))
        try Data("sk_parita_3f9a".utf8).write(to: home.appendingPathComponent(".config/elevenlabs/api-key"))
        try Data("""
        Sei la voce di Clotch.
        Scrivi una frase sola, in italiano parlato.
        Di’ cosa è successo e cosa serve all’utente.
        Niente sigle, niente percorsi di file.
        Massimo 20 parole.
        Se non c’è niente di nuovo, taci.
        """.utf8).write(to: voce.appendingPathComponent("istruzioni.md"))
        let rules: [[String: Any]] = [
            ["id": "a", "condizione": "la 51 è dentro", "quando": ["tipo": "pr-fusa", "valore": "#51"], "creata": 1_760_000_000],
            ["id": "b", "condizione": "chiudi la giornata", "quando": ["tipo": "ora", "valore": "18:30"], "creata": 1_760_000_000]]
        try JSONSerialization.data(withJSONObject: ["regole": rules]).write(to: voce.appendingPathComponent("avvisi.json"))
        return home
    }

    private func render<V: View>(_ view: V, id: String, height: CGFloat, dark: Bool) throws {
        guard let dir = ProcessInfo.processInfo.environment["FIGMA_PARITA_DIR"] else {
            throw XCTSkip("FIGMA_PARITA_DIR not set — parity render is opt-in")
        }
        L10n.shared.language = "it"
        defer { L10n.shared.language = "system" }
        let size = CGSize(width: T.impostazioniMisura678, height: height)
        let image = try OffscreenRender.hosted(view.frame(width: size.width, height: size.height, alignment: .top),
                                               size: size, appearance: dark ? .darkAqua : .aqua, scale: 1)
        XCTAssertEqual(image.width, 678)
        XCTAssertEqual(image.height, Int(height))
        try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        try OffscreenRender.writePNG(image, to: dir + "/\(id).png")
    }

    private func dictation(engine: String, dark: Bool, id: String, download: LocalModelDownload? = nil) throws {
        let page = DictationPage(files: VoiceFiles(home: try home(engine: engine)), width: T.impostazioniMisura678,
                                 localDownload: download, accessOverride: .authorized)
        try render(page, id: id, height: 817, dark: dark)
    }

    func testDettaturaElevenLabsChiaro() throws { try dictation(engine: "scribe", dark: false, id: "91-64184") }
    func testDettaturaElevenLabsScuro() throws { try dictation(engine: "scribe", dark: true, id: "91-64325") }
    func testDettaturaLocaleChiaro() throws { try dictation(engine: "local", dark: false, id: "91-64467", download: LocalModelDownload(doneMB: 270, totalMB: 640)) }
    func testDettaturaLocaleScuro() throws { try dictation(engine: "local", dark: true, id: "91-64608", download: LocalModelDownload(doneMB: 270, totalMB: 640)) }

    private func voice(dark: Bool, id: String) throws {
        let page = VoiceSettingsPage(files: VoiceFiles(home: try home(engine: "scribe")), width: T.impostazioniMisura678)
        try render(page, id: id, height: 1441, dark: dark)
    }

    func testVoceChiaro() throws { try voice(dark: false, id: "91-64814") }
    func testVoceScuro() throws { try voice(dark: true, id: "91-65024") }
}
