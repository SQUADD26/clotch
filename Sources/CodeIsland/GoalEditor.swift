import SwiftUI
import CodeIslandCore

/// A goal's text with «Modifica» under it (#36, #66): Roberto rewrites the goal in place, by «Modifica» or a
/// double click on the text. The field takes the place and size of the whole text and scrolls; Invio or «Salva»
/// saves it, already fixed (`GoalStore.write`: `conferma` with the text); Esc or «Annulla» leaves it as it was.
struct EditableGoalText: View {
    let row: GoalRow
    /// The text shown; nil when the title already says it (the field still starts from the goal).
    let text: String?
    var expanded = false
    @State private var edit = GoalEdit()
    @FocusState private var focused: Bool
    @ObservedObject private var store = GoalStore.shared

    var body: some View {
        VStack(alignment: .leading, spacing: NotchSpace.tight) {
            if let draft = edit.draft {
                // The hidden text sizes the field like the expanded text; the editor scrolls what does not fit.
                Text(draft.isEmpty ? " " : draft)
                    .font(NotchType.body)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .hidden()
                    .overlay {
                        TextEditor(text: Binding { edit.draft ?? "" } set: { edit.draft = $0 })
                            .font(NotchType.body)
                            .foregroundStyle(GoalInk.primary)
                            .scrollContentBackground(.hidden)
                            .padding(.horizontal, -5) // NSTextView's line padding: the words stay where they were
                            .focused($focused)
                            .onAppear { focused = true }
                            .onKeyPress(.return) { save(); return .handled }
                            .onKeyPress(.escape) { edit.cancel(); return .handled }
                    }
                    .background(RoundedRectangle(cornerRadius: 8).fill(GoalInk.well).padding(-6))
                HStack(spacing: 8) {
                    PillButton(title: "Salva", color: GoalTone.go.color, action: save).help("Salva ↩")
                    PillButton(title: "Annulla", color: GoalInk.secondary) { edit.cancel() }.help("Annulla ⎋")
                }
            } else {
                if let text {
                    GoalText(text: text, expanded: expanded)
                        .simultaneousGesture(TapGesture(count: 2).onEnded { begin() })
                }
                HStack(spacing: 8) {
                    PillButton(title: row.goal.isEmpty ? "Scrivi obiettivo" : "Modifica", color: GoalInk.secondary, action: begin)
                        .help(row.goal.isEmpty ? "Scrivi obiettivo" : "Modifica obiettivo")
                    if store.writing.contains(row.id) {
                        Text("Salvando...").font(NotchType.small).foregroundStyle(GoalInk.quiet)
                    } else if store.writeFailed.contains(row.id) {
                        Text("Non salvato. Riprova.").font(NotchType.small).foregroundStyle(GoalTone.stop.color)
                    }
                }
            }
        }
    }

    private func begin() { edit.begin(text ?? row.goal) }
    private func save() { if let draft = edit.save() { store.write(row, text: draft) } }
}

/// A notch pill button: «Salva», «Annulla», «Modifica».
struct PillButton: View {
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(NotchType.smallEmphasis)
                .foregroundStyle(color)
                .padding(.horizontal, 12)
                .frame(height: 26)
                .background(Capsule().fill(color.opacity(0.16)))
                .contentShape(Capsule())
        }
        .buttonStyle(.notchSmall)
    }
}
