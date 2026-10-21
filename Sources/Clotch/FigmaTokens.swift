// Generato da scripts/token-swift.mjs da design/tokens.json (variabili del file Figma Clotch): non si modifica a mano.
// Un valore nuovo si crea prima come variabile in Figma, poi si riesportano i token (skill figma-ui-design, fase 10).
import AppKit
import SwiftUI

enum FigmaToken {
    /// Collezione Figma «macOS 27 · Golden Gate».
    enum MacOS27GoldenGate {
        static let finestraFondo = coppia(chiaro: rgb(0xf6f6f7), scuro: rgb(0x222224))  // finestra/fondo
        static let testoPrimario = coppia(chiaro: rgb(0x1d1d1f), scuro: rgb(0xf2f2f4))  // testo/primario
        static let testoSecondario = coppia(chiaro: rgb(0x6a6a70), scuro: rgb(0xa6a6ac))  // testo/secondario
        static let lineaSeparatore = coppia(chiaro: rgb(0xe2e2e5), scuro: rgb(0x3a3a3d))  // linea/separatore
        static let controlloFondo = coppia(chiaro: rgb(0xffffff), scuro: rgb(0x3b3b3e))  // controllo/fondo
        static let controlloBordo = coppia(chiaro: rgb(0xd3d3d8), scuro: rgb(0x4a4a4e))  // controllo/bordo
        static let campoFondo = coppia(chiaro: rgb(0xffffff), scuro: rgb(0x2b2b2e))  // campo/fondo
        static let campoBordo = coppia(chiaro: rgb(0xd3d3d8), scuro: rgb(0x4a4a4e))  // campo/bordo
        static let accento = coppia(chiaro: rgb(0x0070e0), scuro: rgb(0x0a6cdb))  // accento
        static let traccia = coppia(chiaro: rgb(0xdddde1), scuro: rgb(0x4a4a4e))  // traccia
        static let selezioneFondo = coppia(chiaro: rgb(0xe6e6ea), scuro: rgb(0x38383b))  // selezione/fondo
        static let segmentoFondo = coppia(chiaro: rgb(0xe3e3e7), scuro: rgb(0x353538))  // segmento/fondo
        static let segmentoScelto = coppia(chiaro: rgb(0xffffff), scuro: rgb(0x636366))  // segmento/scelto
        static let icona = coppia(chiaro: rgb(0x6a6a70), scuro: rgb(0xa6a6ac))  // icona
        static let manopola = coppia(chiaro: rgb(0xffffff), scuro: rgb(0xe8e8ec))  // manopola
        static let editorFondo = coppia(chiaro: rgb(0xffffff), scuro: rgb(0x1a1a1c))  // editor/fondo
        static let statoOk = coppia(chiaro: rgb(0x1f7a3a), scuro: rgb(0x30d158))  // stato/ok
        static let errore = coppia(chiaro: rgb(0xc4001a), scuro: rgb(0xff6961))  // errore
        static let semaforoRosso: Color = Color(nsColor: rgb(0xff5f57))  // semaforo/rosso
        static let semaforoGiallo: Color = Color(nsColor: rgb(0xfebc2e))  // semaforo/giallo
        static let semaforoSpento = coppia(chiaro: rgb(0xd4d4d8), scuro: rgb(0x4a4a4e))  // semaforo/spento
    }
}

private func rgb(_ hex: UInt32, _ alpha: CGFloat = 1) -> NSColor {
    NSColor(srgbRed: CGFloat(hex >> 16 & 0xff) / 255, green: CGFloat(hex >> 8 & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: alpha)
}

/// Il modo Figma «Chiaro» o «Scuro» secondo l'aspetto in uso.
private func coppia(chiaro: NSColor, scuro: NSColor) -> Color {
    Color(nsColor: NSColor(name: nil) { $0.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua ? scuro : chiaro })
}
