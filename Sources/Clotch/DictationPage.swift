// figma: 91-64184
import SwiftUI
import AppKit
import AVFoundation
import ClotchCore

/// «Dettatura» (#110, Figma approved): the page of the voice in. On/off, microphone permission, shortcut, mode, engine, language,
/// where the text goes, microphone and spoken answers. Everything but the shortcut lives in the voice `config.json` (`ingresso_*`,
/// read by `VoiceInput.Config`); the shortcut is the app's `ShortcutAction.voiceInput`. The ElevenLabs key is changed in «Voce».
/// Every change is saved at once.
struct DictationPage: View {
    private typealias T = FigmaToken.MacOS27GoldenGate
    private let files: VoiceFiles
    private let width: CGFloat?
    /// Set while the local model downloads; nil when there is nothing to show (the app has no download source yet).
    private let localDownload: LocalModelDownload?
    /// nil = ask the system; the parity test sets it so the page does not depend on the Mac that draws it.
    private let accessOverride: AVAuthorizationStatus?
    @State private var config = VoiceInput.Config([:])
    @State private var binding = ShortcutAction.voiceInput.binding
    @State private var recording = false
    @State private var monitor: Any?
    @State private var note: String?
    @State private var access: AVAuthorizationStatus
    @State private var hasKey = false
    @State private var configBroken = false
    @State private var inputs: [(id: String, name: String)] = []

    init(files: VoiceFiles = VoiceFiles(), width: CGFloat? = nil, localDownload: LocalModelDownload? = nil,
         accessOverride: AVAuthorizationStatus? = nil) {
        self.files = files
        self.width = width
        self.localDownload = localDownload
        self.accessOverride = accessOverride
        _access = State(initialValue: accessOverride ?? AVCaptureDevice.authorizationStatus(for: .audio))
    }

    var body: some View {
        SettingsCardPage(symbol: "mic.fill", tint: T.impostazioniIconaArancio, title: "Dettatura",
                     summary: "Premi la scorciatoia e parla: il notch ascolta, trascrive in diretta e manda il testo a clotch AI.", width: width ?? ClotchSettingsWindow.width) {
            SettingsGroup {
                CardRow(title: "Dettatura accesa", note: "Spenta, la scorciatoia non fa nulla.") {
                    CardSwitch(label: "Dettatura accesa", isOn: Binding(get: { config.enabled }, set: { config.enabled = $0; save() }))
                }
                CardDivider()
                CardRow(title: "Stato microfono") {
                    HStack(spacing: T.notchSpazio8) {
                        if access == .denied || access == .restricted { CardButton(title: "Apri Privacy", action: openPrivacy) }
                        CardStatus(ok: access == .authorized, text: accessText)
                    }
                }
            }
            SettingsGroup {
                CardRow(title: "Scorciatoia", note: ShortcutAction.voiceInput.conflictingAction().map { _ in "Questa scorciatoia è già usata." } ?? modeNote) {
                    HStack(spacing: T.notchSpazio8) {
                        CardField(width: T.impostazioniMisura90) {
                            Text(binding.displayString).font(.settings(T.notchTesto13)).foregroundStyle(T.testoPrimario)
                        }
                        CardButton(title: recording ? "Premi i tasti…" : "Cambia…", action: record)
                    }
                }
                CardDivider()
                CardRow(title: "Modo") {
                    CardMenu(label: "Modo", selection: Binding(get: { config.mode }, set: { config.mode = $0; save() }),
                             options: [(.hold, "Tieni premuto"), (.toggle, "Premi e ripremi")])
                }
            }
            SettingsGroup {
                CardRow(title: "Motore") {
                    CardMenu(label: "Motore", selection: Binding(get: { config.engine }, set: { config.engine = $0; save() }),
                             options: [(.scribe, "ElevenLabs Scribe v2 (in rete)"), (.local, "Su questo Mac (Parakeet v3)")],
                             width: T.impostazioniMisura230)
                }
                CardDivider()
                if config.engine == .scribe {
                    CardRow(title: "Chiave", note: "Il testo compare mentre parli. Si cambia in Voce.") {
                        CardStatus(ok: hasKey, text: hasKey ? "Chiave salvata" : "Manca la chiave")
                    }
                } else {
                    CardRow(title: "Modello locale", note: localDownload.map(\.note) ?? "Resta sul Mac, senza rete. La prima volta scarica il modello.") {
                        if let localDownload { LocalDownloadBar(fraction: localDownload.fraction) }
                    }
                }
                CardDivider()
                CardRow(title: "Lingua", note: "Capisce la lingua mentre parli (italiano, inglese e altre). Scegline una per più precisione.") {
                    CardMenu(label: "Lingua", selection: Binding(get: { config.language }, set: { config.language = $0; save() }),
                             options: VoiceInput.languages.map { ($0.code, $0.name) })
                }
            }
            SettingsGroup(title: "clotch AI") {
                CardRow(title: "Modello clotch AI",
                        note: configBroken ? "Impostazioni illeggibili. Correggi a mano il file config.json della voce."
                        : "Risponde sullo stato del lavoro, scrive alle sessioni, sblocca le chat ferme e apre lavoro nuovo.\nPiù forte: capisce meglio, ma risponde più lento e costa di più.") {
                    CardMenu(label: "Modello clotch AI", selection: Binding(get: { config.overseerModel }, set: { config.overseerModel = $0; save() }),
                             options: [("claude-haiku-5-5", "Haiku 5.5"), ("claude-sonnet-5-5", "Sonnet 5.5"), ("claude-opus-5-5", "Opus 5.5")])
                        .disabled(configBroken)
                }
            }
            SettingsGroup {
                CardRow(title: "Microfono", note: "Segue la scelta di Impostazioni di Sistema.") {
                    CardMenu(label: "Microfono", selection: Binding(get: { config.microphone }, set: { config.microphone = $0; save() }),
                             options: microphoneOptions, width: T.impostazioniMisura200)
                }
                CardDivider()
                CardRow(title: "Rispondi a voce", note: "Una domanda riceve una risposta parlata.") {
                    CardSwitch(label: "Rispondi a voce", isOn: Binding(get: { config.spoken }, set: { config.spoken = $0; save() }))
                }
            }
            VoiceprintSection(microphone: config.microphone)
            if let note { Text(note).font(.settings(T.notchTesto11)).foregroundStyle(T.testoSecondario).frame(maxWidth: .infinity, alignment: .trailing) }
        }
        .onAppear(perform: refresh)
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in refresh() }
        .onDisappear(perform: stopRecording)
    }

    /// A device that is gone stays listed, so the choice is not silently lost.
    private var microphoneOptions: [(String, String)] {
        var all = [("", "Quello del sistema")]
        if !config.microphone.isEmpty, !inputs.contains(where: { $0.id == config.microphone }) { all.append((config.microphone, "Non collegato")) }
        return all + inputs.map { ($0.id, $0.name) }
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
        access = accessOverride ?? AVCaptureDevice.authorizationStatus(for: .audio)
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

    /// What one change writes to config.json: every `ingresso_*` key plus the Friday's model (`overseer_modello`, clotch#286).
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

/// The local model's download as the page shows it: «Scarico… 42% (270 di 640 MB)».
struct LocalModelDownload {
    let doneMB: Int
    let totalMB: Int
    var fraction: Double { Double(doneMB) / Double(max(totalMB, 1)) }
    var note: String { "Scarico… \(Int((fraction * 100).rounded()))% (\(doneMB) di \(totalMB) MB). Intanto la dettatura usa ElevenLabs." }
}

private struct LocalDownloadBar: View {
    private typealias T = FigmaToken.MacOS27GoldenGate
    let fraction: Double

    var body: some View {
        HStack(spacing: 0) {
            Rectangle().fill(T.accento).frame(width: T.notchMisura120 * fraction)
            Rectangle().fill(T.traccia)
        }
        .frame(width: T.notchMisura120, height: T.impostazioniMisura4)
        .clipShape(RoundedRectangle(cornerRadius: T.notchRaggio2))
    }
}
