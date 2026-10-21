import SwiftUI
import AppKit
import ClotchCore

/// «Voce in ingresso» (#110), a block of the «Voce» page: engine, language, shortcut and spoken answers. The engine, language and
/// answers live in the voice `config.json` (`ingresso_*`, read by `VoiceInput.Config`); the shortcut is the app's `ShortcutAction.voiceInput`.
/// Every change is saved at once.
struct VoiceInputSettings: View {
    private let files = VoiceFiles()
    @State private var config = VoiceInput.Config([:])
    @State private var binding = ShortcutAction.voiceInput.binding
    @State private var recording = false
    @State private var monitor: Any?
    @State private var note: String?

    var body: some View {
        Group {
            SettingsRow("Motore") {
                Picker("Motore", selection: Binding(get: { config.engine }, set: { config.engine = $0; save() })) {
                    Text("ElevenLabs Scribe v2").tag(VoiceInput.Engine.scribe)
                    Text("Su questo Mac (Parakeet v3)").tag(VoiceInput.Engine.local)
                }
                .labelsHidden().frame(width: 260)
                SettingsNote(config.engine == .scribe
                             ? "Il testo compare mentre parli. Usa la chiave ElevenLabs."
                             : "Resta sul Mac, senza rete. La prima volta scarica il modello, circa 480 MB.")
            }
            SettingsRow("Lingua") {
                Picker("Lingua", selection: Binding(get: { config.language }, set: { config.language = $0; save() })) {
                    ForEach(VoiceInput.languages, id: \.code) { Text($0.name).tag($0.code) }
                }
                .labelsHidden().frame(width: 200)
            }
            SettingsRow("Scorciatoia") {
                Button(recording ? "Premi i tasti…" : binding.displayString, action: record)
                SettingsNote(ShortcutAction.voiceInput.conflictingAction().map { _ in "Questa scorciatoia è già usata." }
                             ?? "Premi per parlare, premi ancora per finire.")
            }
            SettingsRow("Risposte") {
                SettingsCheckbox(title: "Rispondi a voce",
                                 note: "Una domanda riceve una risposta parlata. Un ordine va all’Overseer.",
                                 isOn: Binding(get: { config.spoken }, set: { config.spoken = $0; save() }))
            }
            if let note { SettingsNote(note).frame(maxWidth: .infinity, alignment: .trailing) }
        }
        .onAppear { config = VoiceInput.Config((try? files.readConfig()) ?? [:]) }
        .onDisappear(perform: stopRecording)
    }

    private func save() {
        do {
            try files.updateConfig(["ingresso_motore": config.engine.rawValue, "ingresso_lingua": config.language, "ingresso_a_voce": config.spoken])
            note = nil
        } catch { note = "Impostazioni non salvate. Riprova." }
    }

    /// The next key press with ⌘, ⌃ or ⌥ becomes the shortcut; Esc cancels.
    private func record() {
        stopRecording()
        recording = true
        monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            if event.keyCode != 53 {
                let mods = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
                guard !mods.isDisjoint(with: [.command, .control, .option]) else { return nil }
                ShortcutAction.voiceInput.setBinding(keyCode: event.keyCode, modifiers: mods)
                ShortcutAction.voiceInput.setEnabled(true)
                binding = ShortcutAction.voiceInput.binding
                (NSApp.delegate as? AppDelegate)?.setupGlobalShortcut()
            }
            stopRecording()
            return nil
        }
    }

    private func stopRecording() {
        if let monitor { NSEvent.removeMonitor(monitor) }
        monitor = nil
        recording = false
    }
}
