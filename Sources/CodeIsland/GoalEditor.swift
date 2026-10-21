import SwiftUI
import CodeIslandCore

/// A goal's text with «Cambia» under it (#36): Roberto writes the goal himself. Invio saves it, already fixed
/// (`GoalStore.write`: `conferma` with the text); Esc closes the field and leaves the goal as it was.
struct EditableGoalText: View {
    let row: GoalRow
    /// The text shown; nil when the title already says it (the field still starts from the goal).
    let text: String?
    var expanded = false
    @State private var editing = false
    @State private var draft = ""
    @FocusState private var focused: Bool
    @ObservedObject private var store = GoalStore.shared

    var body: some View {
        VStack(alignment: .leading, spacing: NotchSpace.tight) {
            if editing {
                TextField("Scrivi obiettivo e come si controlla", text: $draft, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(NotchType.body)
                    .foregroundStyle(GoalInk.primary)
                    .lineLimit(1...4)
                    .focused($focused)
                    .onAppear { focused = true }
                    .onSubmit { store.write(row, text: draft); editing = false }
                    .onExitCommand { editing = false }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(RoundedRectangle(cornerRadius: 8).fill(GoalInk.well))
                Text("Invio salva, Esc annulla").font(NotchType.small).foregroundStyle(GoalInk.quiet)
            } else {
                if let text { GoalText(text: text, expanded: expanded) }
                HStack(spacing: 8) {
                    Button {
                        draft = text ?? row.goal
                        editing = true
                    } label: {
                        Text(row.goal.isEmpty ? "Scrivi obiettivo" : "Cambia")
                            .font(NotchType.smallEmphasis)
                            .foregroundStyle(GoalInk.secondary)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.notchSmall)
                    .help("Scrivi obiettivo")
                    if store.writing.contains(row.id) {
                        Text("Salvando...").font(NotchType.small).foregroundStyle(GoalInk.quiet)
                    } else if store.writeFailed.contains(row.id) {
                        Text("Non salvato. Riprova.").font(NotchType.small).foregroundStyle(GoalTone.stop.color)
                    }
                }
            }
        }
    }
}
