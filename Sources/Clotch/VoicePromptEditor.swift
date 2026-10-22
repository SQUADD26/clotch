// figma: 91-64814
import SwiftUI
import AppKit
import ClotchCore

/// «Istruzioni» (#95): the row shows the start of the instructions in use; «Modifica…» opens a large editor sheet
/// (Roberto: «Serve una modalità più decente di modificare il system prompt»). Saved text goes to `istruzioni.md` and wins
/// over the config's; «Ripristina predefinito» removes it.
struct VoicePromptRow: View {
    private typealias T = FigmaToken.MacOS27GoldenGate
    @Binding var note: String?
    var files = VoiceFiles()
    @State private var prompt = ""
    @State private var own = false
    @State private var editing = false

    var body: some View {
        CardStackRow(title: "Istruzioni") {
            VStack(alignment: .leading, spacing: T.notchSpazio8) {
                Text(prompt.isEmpty ? "Istruzioni mancanti. La voce tace." : prompt)
                    .font(.custom(T.impostazioniFontMonospazio, size: T.notchTesto11))
                    .foregroundStyle(prompt.isEmpty ? T.testoSecondario : T.testoPrimario)
                    .lineSpacing(T.notchInterlinea17 - monoLineHeight)
                    .lineLimit(7)
                    .padding(.horizontal, T.notchSpazio10).padding(.vertical, T.notchSpazio8)
                    .frame(maxWidth: .infinity, minHeight: T.notchMisura120, maxHeight: T.notchMisura120, alignment: .topLeading)
                    .background(RoundedRectangle(cornerRadius: T.notchRaggio6).fill(T.editorFondo))
                    .overlay(RoundedRectangle(cornerRadius: T.notchRaggio6).strokeBorder(T.campoBordo, lineWidth: T.notchSpessore1))
                    .onTapGesture(count: 2) { editing = true }
                HStack(spacing: T.notchSpazio8) {
                    CardButton(title: "Modifica…") { editing = true }
                    CardButton(title: "Ripristina predefinito") {
                        save(failure: "Istruzioni non ripristinate", done: "Istruzioni ripristinate") { try files.resetPrompt() }
                    }
                    .disabled(!own).opacity(own ? 1 : T.notchOpacita45 / 100)
                }
                Text(own ? "In uso: le tue istruzioni." : "In uso: le istruzioni di serie.")
                    .font(.settings(T.notchTesto11)).foregroundStyle(T.testoSecondario).figmaLineHeight()
            }
        }
        .onAppear(perform: load)
        .sheet(isPresented: $editing) {
            VoicePromptEditor(text: prompt) { text in
                save(failure: "Istruzioni non salvate", done: "Istruzioni salvate") { try files.savePrompt(text) }
            }
        }
    }

    /// The natural line height of the editor's font; the Figma text sets 17.
    private var monoLineHeight: CGFloat {
        NSFont(name: T.impostazioniFontMonospazio, size: T.notchTesto11).map { $0.ascender - $0.descender + $0.leading } ?? T.notchTesto13
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
