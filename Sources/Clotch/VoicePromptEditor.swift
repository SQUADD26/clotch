import SwiftUI
import ClotchCore

/// «Istruzioni» (#95): the row shows the start of the instructions in use; «Modifica…» opens a large editor sheet
/// (Roberto: «Serve una modalità più decente di modificare il system prompt»). Saved text goes to `istruzioni.md` and wins
/// over the config's; «Ripristina predefinito» removes it.
struct VoicePromptRow: View {
    @Binding var note: String?
    private let files = VoiceFiles()
    @State private var prompt = ""
    @State private var own = false
    @State private var editing = false

    var body: some View {
        SettingsRow("Istruzioni") {
            Text(prompt.isEmpty ? "Istruzioni mancanti. La voce tace." : prompt)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(prompt.isEmpty ? .secondary : .primary)
                .lineLimit(7)
                .frame(maxWidth: .infinity, minHeight: 104, alignment: .topLeading)
                .padding(EdgeInsets(top: 8, leading: 10, bottom: 8, trailing: 10))
                .background(RoundedRectangle(cornerRadius: 6).fill(Color(nsColor: .textBackgroundColor)))
                .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color(nsColor: .separatorColor)))
                .onTapGesture(count: 2) { editing = true }
            HStack(spacing: 8) {
                Button("Modifica…") { editing = true }
                Button("Ripristina predefinito") {
                    save(failure: "Istruzioni non ripristinate", done: "Istruzioni ripristinate") { try files.resetPrompt() }
                }
                .disabled(!own)
            }
            SettingsNote(own ? "In uso: le tue istruzioni." : "In uso: le istruzioni di serie.")
        }
        .onAppear(perform: load)
        .sheet(isPresented: $editing) {
            VoicePromptEditor(text: prompt) { text in
                save(failure: "Istruzioni non salvate", done: "Istruzioni salvate") { try files.savePrompt(text) }
            }
        }
    }

    private func load() {
        prompt = files.prompt ?? ""
        own = files.hasOwnPrompt
    }

    private func save(failure: String, done: String, _ write: () throws -> Void) {
        do { try write(); note = done } catch { note = "\(failure). Riprova." }
        load()
        VoiceSpeaker.shared.refresh()
    }
}

/// The large editor: the whole text, monospaced, Annulla / Salva.
private struct VoicePromptEditor: View {
    @State var text: String
    let onSave: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Istruzioni della frase").font(.system(size: 13, weight: .semibold))
            SettingsNote("Claude le segue per scrivere ogni frase della voce.")
            TextEditor(text: $text)
                .font(.system(size: 12, design: .monospaced))
                .scrollContentBackground(.hidden)
                .padding(6)
                .background(RoundedRectangle(cornerRadius: 6).fill(Color(nsColor: .textBackgroundColor)))
                .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color(nsColor: .separatorColor)))
            HStack {
                Spacer()
                Button("Annulla") { dismiss() }.keyboardShortcut(.cancelAction)
                Button("Salva") { onSave(text); dismiss() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(20)
        .frame(width: 640, height: 480)
    }
}
