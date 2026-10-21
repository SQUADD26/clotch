import SwiftUI
import ClotchCore

/// «Da confermare» (#20): goals a master proposed that Roberto has not confirmed yet. «Accetta» makes the
/// goal fixed in the register (`GoalStore.accept`); «Rifiuta» hides the proposal in the notch.
struct ProposalsPage: View {
    let rows: [GoalRow]
    let total: Int
    /// The first proposal's text open, as after a click (the gallery's still).
    var openFirst = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    static let perPage = 2

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                IconLabel(symbol: "questionmark.circle", text: "Da confermare")
                Spacer()
                Text("\(total) \(total == 1 ? "proposto" : "proposti")").font(NotchType.label).foregroundStyle(GoalInk.secondary)
            }
            ForEach(rows) { ProposalLine(row: $0, open: openFirst && $0.id == rows.first?.id).transition(.notchRow(reduce: reduceMotion)) }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .animation(NotchMotion.animation(reduce: reduceMotion), value: rows.map(\.id))
    }
}

private struct ProposalLine: View {
    let row: GoalRow
    let open: Bool
    @ObservedObject private var store = GoalStore.shared

    var body: some View {
        let text = row.proposal ?? row.goal
        let busy = store.accepting.contains(row.id)
        HStack(alignment: .center, spacing: NotchSpace.section) {
            VStack(alignment: .leading, spacing: 2) {
                Text(row.title).font(NotchType.name).foregroundStyle(GoalInk.primary).lineLimit(1)
                EditableGoalText(row: row, text: text, expanded: open)
                if store.acceptFailed.contains(row.id) {
                    Text("Non accettato. Riprova.").font(NotchType.caption).foregroundStyle(GoalTone.stop.color)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 8) {
                Button("Rifiuta") { store.reject(row) }.buttonStyle(.tone(.stop))
                Button("Accetta") { store.accept(row) }.buttonStyle(.tone(.go)).disabled(busy).opacity(busy ? 0.5 : 1)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(row.title). \(text)")
    }
}
