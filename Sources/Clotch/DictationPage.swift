// figma: 91-64148
import SwiftUI
import AppKit
import AVFoundation
import ClotchCore

/// «Dettatura» (#110, Figma approved): the page of the voice in. On/off, microphone permission, shortcut, mode, engine, language,
/// where the text goes, microphone and spoken answers. Everything but the shortcut lives in the voice `config.json` (`ingresso_*`,
/// read by `VoiceInput.Config`); the shortcut is the app's `ShortcutAction.voiceInput`. The ElevenLabs key is changed in «Voce».
/// Every change is saved at once.
struct DictationPage: View {
    private let files = VoiceFiles()
    @State private var config = VoiceInput.Config([:])
    @State private var binding = ShortcutAction.voiceInput.binding
    @State private var recording = false
    @State private var monitor: Any?
    @State private var note: String?
    @State private var access = AVCaptureDevice.authorizationStatus(for: .audio)
    @State private var hasKey = false
    @State private var configBroken = false
    @State private var inputs: [(id: String, name: String)] = []

    var body: some View {
        SettingsForm {
            SettingsRow("Dettatura") {
                SettingsCheckbox(title: "Dettatura accesa", note: "Spenta, la scorciatoia non fa nulla.",
                                 isOn: Binding(get: { config.enabled }, set: { config.enabled = $0; save() }))
            }
            SettingsRow("Stato microfono") {
                HStack(spacing: 6) {
                    Circle().fill(access == .authorized ? Color.green : Color.orange).frame(width: 8, height: 8)
                    Text(accessText)
                    if access == .denied || access == .restricted { Button("Apri Privacy", action: openPrivacy) }
                }
            }
            Divider()
            SettingsRow("Scorciatoia") {
                HStack(spacing: 8) {
                    Text(binding.displayString).font(.system(size: 13, weight: .medium))
                    Button(recording ? "Premi i tasti…" : "Cambia…", action: record)
                }
                SettingsNote(ShortcutAction.voiceInput.conflictingAction().map { _ in "Questa scorciatoia è già usata." } ?? modeNote)
            }
            SettingsRow("Modo") {
                Picker("Modo", selection: Binding(get: { config.mode }, set: { config.mode = $0; save() })) {
                    Text("Tieni premuto").tag(VoiceInput.Mode.hold)
                    Text("Premi e ripremi").tag(VoiceInput.Mode.toggle)
                }
                .labelsHidden().frame(width: 200)
            }
            Divider()
            SettingsRow("Motore") {
                Picker("Motore", selection: Binding(get: { config.engine }, set: { config.engine = $0; save() })) {
                    Text("ElevenLabs Scribe v2").tag(VoiceInput.Engine.scribe)
                    Text("Su questo Mac (Parakeet v3)").tag(VoiceInput.Engine.local)
                }
                .labelsHidden().frame(width: 260)
            }
            if config.engine == .scribe {
                SettingsRow("Chiave") {
                    HStack(spacing: 6) {
                        Circle().fill(hasKey ? Color.green : Color.orange).frame(width: 8, height: 8)
                        Text(hasKey ? "Chiave salvata" : "Manca la chiave")
                    }
                    SettingsNote("Il testo compare mentre parli. Si cambia in Voce.")
                }
            } else {
                SettingsRow("Modello locale") {
                    Text("Parakeet v3")
                    SettingsNote("Resta sul Mac, senza rete. La prima volta scarica il modello, circa 480 MB.")
                }
            }
            SettingsRow("Lingua") {
                Picker("Lingua", selection: Binding(get: { config.language }, set: { config.language = $0; save() })) {
                    ForEach(VoiceInput.languages, id: \.code) { Text($0.name).tag($0.code) }
                }
                .labelsHidden().frame(width: 200)
            }
            Divider()
            SettingsRow("Modello Overseer") {
                Picker("Modello Overseer", selection: Binding(get: { config.overseerModel }, set: { config.overseerModel = $0; save() })) {
                    Text("Haiku 5.5").tag("claude-haiku-5-5")
                    Text("Sonnet 5.5").tag("claude-sonnet-5-5")
                    Text("Opus 5.5").tag("claude-opus-5-5")
                }
                .labelsHidden().frame(width: 200).disabled(configBroken)
                SettingsNote(configBroken ? "Impostazioni illeggibili. Correggi a mano il file config.json della voce."
                             : "Risponde sullo stato del lavoro, scrive alle sessioni, sblocca le chat ferme e apre lavoro nuovo.\nPiù forte: capisce meglio, ma risponde più lento e costa di più.")
            }
            SettingsRow("Microfono") {
                Picker("Microfono", selection: Binding(get: { config.microphone }, set: { config.microphone = $0; save() })) {
                    Text("Quello del sistema").tag("")
                    // A device that is gone stays listed, so the choice is not silently lost.
                    if !config.microphone.isEmpty, !inputs.contains(where: { $0.id == config.microphone }) {
                        Text("Non collegato").tag(config.microphone)
                    }
                    ForEach(inputs, id: \.id) { Text($0.name).tag($0.id) }
                }
                .labelsHidden().frame(width: 260)
            }
            SettingsRow("Risposte") {
                SettingsCheckbox(title: "Rispondi a voce",
                                 note: "Una domanda riceve una risposta parlata.",
                                 isOn: Binding(get: { config.spoken }, set: { config.spoken = $0; save() }))
            }
            if let note { SettingsNote(note).frame(maxWidth: .infinity, alignment: .trailing) }
        }
        .onAppear(perform: refresh)
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in refresh() }
        .onDisappear(perform: stopRecording)
    }

    private var modeNote: String {
        config.mode == .hold ? "Tieni premuto per parlare, rilascia per finire." : "Premi per parlare, premi ancora per finire."
    }

    private var accessText: String {
        switch access {
        case .authorized: return "Consentito"
        case .notDetermined: return "Da consentire al primo uso"
        default: return "Non consentito"
        }
    }

    private func refresh() {
        let read = try? files.readConfig()
        configBroken = read == nil
        config = VoiceInput.Config(read ?? [:])
        access = AVCaptureDevice.authorizationStatus(for: .audio)
        hasKey = files.hasKey
        inputs = VoiceCapture.inputs()
    }

    private func openPrivacy() {
        NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")!)
    }

    private func save() {
        do {
            try files.updateConfig(Self.changes(config))
            note = nil
        } catch { note = "Impostazioni non salvate. Riprova." }
    }

    /// What one change writes to config.json: every `ingresso_*` key plus the Overseer's model (`overseer_modello`, clotch#286).
    static func changes(_ config: VoiceInput.Config) -> [String: Any] {
        ["ingresso_motore": config.engine.rawValue, "ingresso_lingua": config.language, "ingresso_a_voce": config.spoken,
         "ingresso_modo": config.mode.rawValue, "ingresso_acceso": config.enabled, "ingresso_microfono": config.microphone,
         "overseer_modello": config.overseerModel]
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
