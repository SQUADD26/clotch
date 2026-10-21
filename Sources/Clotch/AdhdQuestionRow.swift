// figma: 42-48321
// Prova del flusso «prima Figma, poi codice» (#123, claude-config#1942): una riga della scheda ADHD, domanda senza
// risposta. Non è ancora nell'app: il disegno (Section 42-45145) aspetta l'approvazione di Roberto.
// Parità col disegno: AdhdParityTests scrive il PNG, parita.mjs (skill figma-ui-design) lo confronta con design/figma/42-48321.png.
import SwiftUI

struct AdhdQuestionRow: View {
    let question: String
    /// «Chiesta 3 volte · ieri · a Clotch: correzioni notch».
    let detail: String
    var nudge: () -> Void = {}

    var body: some View {
        HStack(spacing: 0) {
            Text("?")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(GoalTone.wait.color)
                .frame(width: 40)
            VStack(alignment: .leading, spacing: NotchSpace.tight) {
                Text(question).font(NotchType.line).foregroundStyle(GoalInk.row)
                Text(detail).font(NotchType.small).foregroundStyle(GoalInk.secondary)
            }
            .lineLimit(1)
            Spacer(minLength: 12)
            Button(action: nudge) {
                IconLabel(symbol: "paperplane", text: "Sollecita", font: NotchType.small, color: GoalInk.row)
                    .padding(.horizontal, 10)
                    .frame(height: 22)
                    .background(Capsule().fill(GoalInk.button))
            }
            .buttonStyle(.plain)
            .padding(.trailing, 12)
        }
        .frame(height: 54)
        .background(RoundedRectangle(cornerRadius: 12).fill(GoalTone.wait.color.opacity(0.12)))
    }
}
