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
        static let notchNero: Color = Color(nsColor: rgb(0x000000))  // notch/nero
        static let notchTesto9: CGFloat = 9  // notch/testo/9
        static let notchTesto11: CGFloat = 11  // notch/testo/11
        static let notchTesto12: CGFloat = 12  // notch/testo/12
        static let notchTesto13: CGFloat = 13  // notch/testo/13
        static let notchTesto14: CGFloat = 14  // notch/testo/14
        static let notchTesto15: CGFloat = 15  // notch/testo/15
        static let notchTesto30: CGFloat = 30  // notch/testo/30
        static let notchRaggio2: CGFloat = 2  // notch/raggio/2
        static let notchRaggio3: CGFloat = 3  // notch/raggio/3
        static let notchRaggio6: CGFloat = 6  // notch/raggio/6
        static let notchRaggio7: CGFloat = 7  // notch/raggio/7
        static let notchRaggio10: CGFloat = 10  // notch/raggio/10
        static let notchRaggio11: CGFloat = 11  // notch/raggio/11
        static let notchRaggio12: CGFloat = 12  // notch/raggio/12
        static let notchRaggio14: CGFloat = 14  // notch/raggio/14
        static let notchRaggio15: CGFloat = 15  // notch/raggio/15
        static let notchRaggio16: CGFloat = 16  // notch/raggio/16
        static let notchRaggio18: CGFloat = 18  // notch/raggio/18
        static let notchRaggio19: CGFloat = 19  // notch/raggio/19
        static let notchRaggio20: CGFloat = 20  // notch/raggio/20
        static let notchRaggio28: CGFloat = 28  // notch/raggio/28
        static let notchRaggio40: CGFloat = 40  // notch/raggio/40
        static let notchRaggio1_5: CGFloat = 1.5  // notch/raggio/1_5
        static let notchBianco: Color = Color(nsColor: rgb(0xffffff))  // notch/bianco
        static let notchGiallo: Color = Color(nsColor: rgb(0xffd60a))  // notch/giallo
        static let notchVerde: Color = Color(nsColor: rgb(0x30d158))  // notch/verde
        static let notchSpessore1: CGFloat = 1  // notch/spessore/1
        static let notchSpessore3: CGFloat = 3  // notch/spessore/3
        static let notchSpessore9: CGFloat = 9  // notch/spessore/9
        static let notchSpessore1_4: CGFloat = 1.399999976158142  // notch/spessore/1_4
        static let notchSpessore1_4167: CGFloat = 1.4166666269302368  // notch/spessore/1_4167
        static let notchSpessore1_3125: CGFloat = 1.3125  // notch/spessore/1_3125
        static let notchSpessore1_1667: CGFloat = 1.1666666269302368  // notch/spessore/1_1667
        static let notchSpessore2_1333: CGFloat = 2.133333444595337  // notch/spessore/2_1333
        static let notchSpessore1_2188: CGFloat = 1.21875  // notch/spessore/1_2188
        static let notchSpessore1_125: CGFloat = 1.125  // notch/spessore/1_125
        static let notchSpessore1_0833: CGFloat = 1.0833333730697632  // notch/spessore/1_0833
        static let notchSpessore1_3: CGFloat = 1.2999999523162842  // notch/spessore/1_3
        static let notchSpessore1_8667: CGFloat = 1.8666666746139526  // notch/spessore/1_8667
        static let notchSpessore1_2: CGFloat = 1.2000000476837158  // notch/spessore/1_2
        static let notchSpessore1_5167: CGFloat = 1.5166665315628052  // notch/spessore/1_5167
        static let notchSpessore1_7333: CGFloat = 1.7333333492279053  // notch/spessore/1_7333
        static let notchSpessore1_3333: CGFloat = 1.3333333730697632  // notch/spessore/1_3333
        static let notchInterlinea17: CGFloat = 17  // notch/interlinea/17
        static let notchInterlinea18: CGFloat = 18  // notch/interlinea/18
        static let notchInterlinea19: CGFloat = 19  // notch/interlinea/19
        static let notchInterlinea20: CGFloat = 20  // notch/interlinea/20
        static let notchColore30d159: Color = Color(nsColor: rgb(0x30d159))  // notch/colore/30d159
        static let notchColore2c2c30: Color = Color(nsColor: rgb(0x2c2c30))  // notch/colore/2c2c30
        static let notchColore2b2b30: Color = Color(nsColor: rgb(0x2b2b30))  // notch/colore/2b2b30
        static let notchNeroA88: Color = Color(nsColor: rgb(0x000000, 0.878))  // notch/nero-a88
        static let notchBiancoA22: Color = Color(nsColor: rgb(0xffffff, 0.22))  // notch/bianco-a22
        static let notchBiancoA35: Color = Color(nsColor: rgb(0xffffff, 0.349))  // notch/bianco-a35
        static let notchBiancoA18: Color = Color(nsColor: rgb(0xffffff, 0.18))  // notch/bianco-a18
        static let notchBiancoA55: Color = Color(nsColor: rgb(0xffffff, 0.549))  // notch/bianco-a55
        static let notchBiancoA12: Color = Color(nsColor: rgb(0xffffff, 0.122))  // notch/bianco-a12
        static let notchBiancoA92: Color = Color(nsColor: rgb(0xffffff, 0.922))  // notch/bianco-a92
        static let notchOpacita45: Double = 45  // notch/opacita/45
        static let notchBiancoA10: Color = Color(nsColor: rgb(0xffffff, 0.102))  // notch/bianco-a10
        static let notchBiancoA60: Color = Color(nsColor: rgb(0xffffff, 0.6))  // notch/bianco-a60
        static let notchBiancoA75: Color = Color(nsColor: rgb(0xffffff, 0.749))  // notch/bianco-a75
        static let notchBiancoA7: Color = Color(nsColor: rgb(0xffffff, 0.071))  // notch/bianco-a7
        static let notchBiancoA16: Color = Color(nsColor: rgb(0xffffff, 0.161))  // notch/bianco-a16
        static let notchBiancoA88: Color = Color(nsColor: rgb(0xffffff, 0.878))  // notch/bianco-a88
        static let notchBiancoA8: Color = Color(nsColor: rgb(0xffffff, 0.078))  // notch/bianco-a8
        static let notchBiancoA90: Color = Color(nsColor: rgb(0xffffff, 0.898))  // notch/bianco-a90
        static let notchBiancoA25: Color = Color(nsColor: rgb(0xffffff, 0.251))  // notch/bianco-a25
        static let notchBiancoA6: Color = Color(nsColor: rgb(0xffffff, 0.059))  // notch/bianco-a6
        static let notchBiancoA50: Color = Color(nsColor: rgb(0xffffff, 0.502))  // notch/bianco-a50
        static let notchGialloA12: Color = Color(nsColor: rgb(0xffd60a, 0.122))  // notch/giallo-a12
        static let notchBiancoA45: Color = Color(nsColor: rgb(0xffffff, 0.451))  // notch/bianco-a45
        static let notchBiancoA94: Color = Color(nsColor: rgb(0xffffff, 0.941))  // notch/bianco-a94
        static let notchNeroA92: Color = Color(nsColor: rgb(0x000000, 0.922))  // notch/nero-a92
        static let notchBiancoA30: Color = Color(nsColor: rgb(0xffffff, 0.302))  // notch/bianco-a30
        static let notchNeroA90: Color = Color(nsColor: rgb(0x000000, 0.898))  // notch/nero-a90
        static let notchNeroA80: Color = Color(nsColor: rgb(0x000000, 0.8))  // notch/nero-a80
        static let notchNeroA70: Color = Color(nsColor: rgb(0x000000, 0.698))  // notch/nero-a70
        static let notchNeroA60: Color = Color(nsColor: rgb(0x000000, 0.6))  // notch/nero-a60
        static let notchNeroA50: Color = Color(nsColor: rgb(0x000000, 0.502))  // notch/nero-a50
        static let notchNeroA40: Color = Color(nsColor: rgb(0x000000, 0.4))  // notch/nero-a40
        static let notchNeroA30: Color = Color(nsColor: rgb(0x000000, 0.302))  // notch/nero-a30
        static let notchNeroA20: Color = Color(nsColor: rgb(0x000000, 0.2))  // notch/nero-a20
        static let notchNeroA10: Color = Color(nsColor: rgb(0x000000, 0.102))  // notch/nero-a10
        static let notchNeroA36: Color = Color(nsColor: rgb(0x000000, 0.361))  // notch/nero-a36
        static let notchGialloA90: Color = Color(nsColor: rgb(0xffd60a, 0.898))  // notch/giallo-a90
        static let notchSpazio1: CGFloat = 1  // notch/spazio/1
        static let notchSpazio2: CGFloat = 2  // notch/spazio/2
        static let notchSpazio3: CGFloat = 3  // notch/spazio/3
        static let notchSpazio4: CGFloat = 4  // notch/spazio/4
        static let notchSpazio6: CGFloat = 6  // notch/spazio/6
        static let notchSpazio8: CGFloat = 8  // notch/spazio/8
        static let notchSpazio9: CGFloat = 9  // notch/spazio/9
        static let notchSpazio10: CGFloat = 10  // notch/spazio/10
        static let notchSpazio12: CGFloat = 12  // notch/spazio/12
        static let notchSpazio14: CGFloat = 14  // notch/spazio/14
        static let notchSpazio16: CGFloat = 16  // notch/spazio/16
        static let notchSpazio18: CGFloat = 18  // notch/spazio/18
        static let notchSpazio20: CGFloat = 20  // notch/spazio/20
        static let notchSpazio21: CGFloat = 21  // notch/spazio/21
        static let notchSpazio24: CGFloat = 24  // notch/spazio/24
        static let notchSpazio26: CGFloat = 26  // notch/spazio/26
        static let notchSpazio35: CGFloat = 35  // notch/spazio/35
        static let notchSpazio42: CGFloat = 42  // notch/spazio/42
        static let notchSpazio16_5: CGFloat = 16.5  // notch/spazio/16_5
        static let notchBiancoA95: Color = Color(nsColor: rgb(0xffffff, 0.949))  // notch/bianco-a95
        static let notchBiancoA80: Color = Color(nsColor: rgb(0xffffff, 0.8))  // notch/bianco-a80
        static let notchGialloA22: Color = Color(nsColor: rgb(0xffd60a, 0.22))  // notch/giallo-a22
        static let notchRosso: Color = Color(nsColor: rgb(0xff453b))  // notch/rosso
        static let notchGialloA18: Color = Color(nsColor: rgb(0xffd60a, 0.18))  // notch/giallo-a18
        static let notchRossoA18: Color = Color(nsColor: rgb(0xff453b, 0.18))  // notch/rosso-a18
        static let notchBiancoA62: Color = Color(nsColor: rgb(0xffffff, 0.62))  // notch/bianco-a62
        static let notchBiancoA40: Color = Color(nsColor: rgb(0xffffff, 0.4))  // notch/bianco-a40
        static let notchMisura22: CGFloat = 22  // notch/misura/22
        static let notchMisura24: CGFloat = 24  // notch/misura/24
        static let notchMisura28: CGFloat = 28  // notch/misura/28
        static let notchMisura30: CGFloat = 30  // notch/misura/30
        static let notchMisura36: CGFloat = 36  // notch/misura/36
        static let notchMisura38: CGFloat = 38  // notch/misura/38
        static let notchMisura40: CGFloat = 40  // notch/misura/40
        static let notchMisura54: CGFloat = 54  // notch/misura/54
        static let notchMisura86: CGFloat = 86  // notch/misura/86
        static let notchMisura120: CGFloat = 120  // notch/misura/120
        static let notchMisura420: CGFloat = 420  // notch/misura/420
        static let notchMisura422: CGFloat = 422  // notch/misura/422
        static let notchMisura458: CGFloat = 458  // notch/misura/458
        static let notchMisura488: CGFloat = 488  // notch/misura/488
        static let notchMisura578: CGFloat = 578  // notch/misura/578
        static let notchMisura103_5: CGFloat = 103.5  // notch/misura/103_5
        static let notchFontFamiglia: String = "SF Pro"  // notch/font/famiglia
        static let notchFontMedio: String = "Medium"  // notch/font/medio
        static let notchFontSemibold: String = "Semibold"  // notch/font/semibold
    }
}

private func rgb(_ hex: UInt32, _ alpha: CGFloat = 1) -> NSColor {
    NSColor(srgbRed: CGFloat(hex >> 16 & 0xff) / 255, green: CGFloat(hex >> 8 & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: alpha)
}

/// Il modo Figma «Chiaro» o «Scuro» secondo l'aspetto in uso.
private func coppia(chiaro: NSColor, scuro: NSColor) -> Color {
    Color(nsColor: NSColor(name: nil) { $0.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua ? scuro : chiaro })
}
