// figma: 53-55032
// Prova del flusso «prima Figma, poi codice» (#123, claude-config#1942): una riga della scheda ADHD, domanda senza
// risposta. Non è ancora nell'app: il disegno (Section 42-45145) aspetta l'approvazione di Roberto.
// Parità col disegno: AdhdParityTests scrive il PNG, parita.mjs (skill figma-ui-design) lo confronta con design/figma/42-48321.png.
import SwiftUI

private typealias T = FigmaToken.MacOS27GoldenGate

struct AdhdQuestionRow: View {
    let question: String
    /// «Chiesta 3 volte · ieri · a Clotch: correzioni notch».
    let detail: String
    var nudge: () -> Void = {}

    var body: some View {
        HStack(spacing: 0) {
            Text("?")
                .font(.system(size: T.notchTesto15, weight: .semibold))
                .foregroundStyle(T.notchGiallo)
                .frame(width: T.notchMisura40)
            VStack(alignment: .leading, spacing: T.notchSpazio4) {
                Text(question).font(.system(size: T.notchTesto14, weight: .medium)).foregroundStyle(T.notchBiancoA92)
                Text(detail).font(.system(size: T.notchTesto11, weight: .medium)).foregroundStyle(T.notchBiancoA55)
            }
            .lineLimit(1)
            Spacer(minLength: 0)
            Button(action: nudge) {
                IconLabel(symbol: "paperplane", text: "Sollecita", font: .system(size: T.notchTesto11, weight: .semibold), color: T.notchBiancoA92)
                    .padding(.horizontal, T.notchSpazio10)
                    .frame(height: T.notchMisura22)
                    .background(RoundedRectangle(cornerRadius: T.notchRaggio11).fill(T.notchBiancoA12))
            }
            .buttonStyle(.plain)
            .padding(.trailing, T.notchSpazio12)
        }
        .frame(height: T.notchMisura54)
        .background(RoundedRectangle(cornerRadius: T.notchRaggio12).fill(T.notchGialloA12))
    }
}
