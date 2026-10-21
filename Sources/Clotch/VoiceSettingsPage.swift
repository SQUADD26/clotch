import SwiftUI
import AppKit
import ClotchCore

/// «Voce» (#38, #50, #57, Figma #95): on/off, «Parla per», other sounds, the two keys, voice, speed, daily limits, a test,
/// Haiku's instructions and the alerts. Files and rules live in `VoiceFiles`, the speaking in `VoiceSpeaker`;
/// the text is Italian like the rest of Clotch's own pages. Every change is saved at once: the page has no «Salva».
struct VoiceSettingsPage: View {
    private let files = VoiceFiles()
    /// ElevenLabs models offered in the menu; a model written by hand in config.json is listed too.
    private static let models = [("eleven_v4_turbo", "Turbo v4"), ("eleven_flash_v2_5", "Flash v2.5"),
                                 ("eleven_multilingual_v2", "Multilingual v2"), ("eleven_v3", "v3")]

    @State private var isOn = true
    @State private var key: String?
    @State private var jevKey: String?
    @State private var voiceId = ""
    @State private var model = VoiceFiles.defaultModel
    @State private var speed = VoiceFiles.defaultSpeed
    @State private var maxCalls = VoiceFiles.defaultMaxCalls
    @State private var maxChars = VoiceFiles.defaultMaxChars
    @State private var hasPrompt = true
    @State private var audience = VoiceTurn.Config.Audience.main
    @State private var onlySession = ""
    @State private var sessions: [DesktopSession] = []
    @State private var duck = false
    @State private var duckPercent = VoiceDuck.defaultLevel * 100
    @State private var configBroken = false
    @State private var testing = false
    @State private var note: String?

    var body: some View {
        SettingsForm {
            SettingsNote("La voce parla solo quando serve: richiesta fatta, obiettivo raggiunto o bloccato, domanda per te, rischio, avviso che hai chiesto. Prima Claude Haiku scrive una frase breve, poi ElevenLabs la legge con la voce scelta.")
            SettingsRow("Voce") {
                SettingsCheckbox(title: "Voce accesa", isOn: Binding(get: { isOn }, set: { on in
                    run("Voce non salvata") { try files.setOn(on) }
                    isOn = files.isOn
                    VoiceSpeaker.shared.refresh()
                }))
            }
            SettingsRow("Stato") {
                HStack(spacing: 6) {
                    Circle().fill(key == nil ? Color.orange : Color.green).frame(width: 8, height: 8)
                    Text(key == nil ? "Manca la chiave" : "Chiave salvata")
                }
                if !hasPrompt { SettingsNote("Istruzioni della voce mancanti. La voce tace.") }
            }
            SettingsRow("Parla per") {
                Picker("Parla per", selection: Binding(get: { audience }, set: { audience = $0; saveAudience() })) {
                    Text("Tutte le sessioni").tag(VoiceTurn.Config.Audience.all)
                    Text("Solo le sessioni principali").tag(VoiceTurn.Config.Audience.main)
                    Text("Solo una sessione").tag(VoiceTurn.Config.Audience.one)
                }
                .labelsHidden().frame(width: 240)
                if audience == .one {
                    Picker("Sessione", selection: Binding(get: { onlySession }, set: { onlySession = $0; saveAudience() })) {
                        if sessions.isEmpty { Text("Nessuna sessione").tag("") }
                        ForEach(sessions, id: \.localId) { s in Text(s.title.isEmpty ? "Senza titolo" : s.title).tag(s.localId) }
                    }
                    .labelsHidden().frame(width: 240)
                }
                SettingsNote("Principali: quelle aperte da te, non da un’altra sessione.")
            }
            .disabled(configBroken)
            SettingsRow("Altri suoni") {
                SettingsCheckbox(title: "Abbassa l’audio mentre parla",
                                 note: "Musica e video scendono mezzo secondo prima della voce. Al primo uso macOS chiede il permesso.",
                                 isOn: Binding(get: { duck }, set: { duck = $0; saveDuck() }))
                if duck {
                    SettingsSlider(value: $duckPercent,
                                   range: (VoiceDuck.levelRange.lowerBound * 100)...(VoiceDuck.levelRange.upperBound * 100), step: 5,
                                   ticks: ["\(Int(VoiceDuck.levelRange.lowerBound * 100))%", "\(Int(VoiceDuck.levelRange.upperBound * 100))%"],
                                   shown: "\(Int(duckPercent))%", label: "Volume degli altri suoni", onEnd: saveDuck)
                }
            }
            .disabled(configBroken)
            Divider()
            keyRow("Chiave ElevenLabs", masked: key, note: "Creala su elevenlabs.io, in Developers › API Keys. Resta solo su questo Mac.") {
                try files.saveKey($0)
            }
            keyRow("Chiave Jev", masked: jevKey, note: "Prima di parlare, la voce chiede a Jev se la novità ti serve. Resta solo su questo Mac.") {
                try files.saveJevKey($0)
            }
            Divider()
            reading
            Divider()
            VoicePromptRow(note: $note)
            Divider()
            VoiceAlertsSection(sessions: sessions, note: $note)
            if let note { SettingsNote(note).frame(maxWidth: .infinity, alignment: .trailing) }
        }
        .onAppear(perform: load)
        .onDisappear { if !configBroken { saveConfig() } }
        .task {
            // The open ones, newest first; the chosen one stays listed even when archived.
            sessions = await GoalStore.shared.allSessions()
                .filter { !$0.isArchived || $0.localId == onlySession }
                .sorted { ($0.lastActivity ?? .distantPast) > ($1.lastActivity ?? .distantPast) }
        }
    }

    /// Voice, model, speed, limits and the test.
    @ViewBuilder private var reading: some View {
        SettingsRow("ID voce") {
            TextField("ID voce", text: $voiceId, prompt: Text("Lascia vuoto per la voce di serie"))
                .labelsHidden().frame(width: 260).onSubmit(saveConfig)
        }
        SettingsRow("Modello") {
            Picker("Modello", selection: Binding(get: { model }, set: { model = $0; saveConfig() })) {
                ForEach(Self.models, id: \.0) { Text($0.1).tag($0.0) }
                if !Self.models.contains(where: { $0.0 == model }) { Text(model).tag(model) }
            }
            .labelsHidden().frame(width: 200)
        }
        SettingsRow("Velocità") {
            SettingsSlider(value: $speed, range: VoiceFiles.speedRange, step: 0.05,
                           ticks: [times(VoiceFiles.speedRange.lowerBound), times(VoiceFiles.speedRange.upperBound)],
                           shown: times(speed), label: "Velocità", onEnd: saveConfig)
        }
        SettingsRow("Limiti al giorno") {
            HStack(spacing: 8) {
                TextField("Frasi al giorno", value: $maxCalls, format: .number).labelsHidden().frame(width: 64).onSubmit(saveConfig)
                Text("frasi")
                TextField("Caratteri al giorno", value: $maxChars, format: .number).labelsHidden().frame(width: 80).onSubmit(saveConfig)
                Text("caratteri")
            }
            SettingsNote(configBroken
                         ? "Impostazioni illeggibili. Correggi a mano il file config.json della voce."
                         : "Oltre i limiti la voce tace fino a domani.")
        }
        SettingsRow("") {
            Button(testing ? "Prova in corso…" : "Prova voce", action: test).disabled(testing)
        }
        .disabled(configBroken)
    }

    /// A saved key shows as dots and its last 4 characters; «Incolla chiave» saves what is on the clipboard.
    private func keyRow(_ label: String, masked: String?, note: String, save: @escaping (String) throws -> Void) -> some View {
        SettingsRow(label) {
            HStack(spacing: 8) {
                Text(masked ?? "Chiave non salvata")
                    .font(masked == nil ? .system(size: 13) : .system(size: 13, design: .monospaced))
                    .foregroundStyle(masked == nil ? .secondary : .primary)
                    .lineLimit(1)
                    .padding(.horizontal, 7)
                    .frame(width: 200, height: 22, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 6).fill(Color(nsColor: .textBackgroundColor)))
                    .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color(nsColor: .separatorColor)))
                    .accessibilityLabel(Text(label))
                Button("Incolla chiave") {
                    let pasted = NSPasteboard.general.string(forType: .string)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                    guard pasted.count >= 8 else { self.note = "Negli appunti non c’è una chiave."; return }
                    run("Chiave non salvata", done: "Chiave salvata") { try save(pasted) }
                    load()
                    VoiceSpeaker.shared.refresh()
                }
            }
            SettingsNote(note)
        }
    }

    private func times(_ v: Double) -> String { settingsDecimal(v) + "×" }

    private func load() {
        isOn = files.isOn
        key = files.masked(files.keyURL)
        jevKey = files.masked(files.jevKeyURL)
        hasPrompt = files.prompt != nil
        guard let config = try? files.readConfig() else { configBroken = true; return }
        voiceId = config["voice_id"] as? String ?? ""
        model = config["model_id"] as? String ?? VoiceFiles.defaultModel
        speed = min(max((config["speed"] as? NSNumber)?.doubleValue ?? VoiceFiles.defaultSpeed, 0.7), 2.0)
        maxCalls = (config["tetto_chiamate"] as? NSNumber)?.intValue ?? VoiceFiles.defaultMaxCalls
        maxChars = (config["tetto_caratteri"] as? NSNumber)?.intValue ?? VoiceFiles.defaultMaxChars
        let parsed = VoiceTurn.Config(config)
        audience = parsed.audience
        onlySession = parsed.onlySession
        duck = parsed.duck
        duckPercent = (parsed.duckLevel * 100).rounded()
    }

    private func saveDuck() {
        run("Impostazioni non salvate") {
            try files.updateConfig(["abbassa_audio": duck, "abbassa_livello": Int(duckPercent)])
        }
    }

    private func saveAudience() {
        run("Impostazioni non salvate") {
            try files.updateConfig(["parla_per": audience.rawValue, "sessione": onlySession])
        }
    }

    private func saveConfig() {
        guard !configBroken else { return }
        run("Impostazioni non salvate") {
            try files.updateConfig([
                "voice_id": voiceId.trimmingCharacters(in: .whitespacesAndNewlines),
                "model_id": model.trimmingCharacters(in: .whitespacesAndNewlines),
                "speed": (speed * 100).rounded() / 100,
                "tetto_chiamate": max(0, maxCalls),
                "tetto_caratteri": max(0, maxChars),
            ])
        }
    }

    private func run(_ failure: String, done: String? = nil, _ write: () throws -> Void) {
        do { try write(); if let done { note = done } } catch { note = "\(failure). Riprova." }
    }

    /// Saves the values on screen, then says one fixed sentence with them (even with the voice off).
    private func test() {
        saveConfig()
        testing = true
        Task {
            note = await VoiceSpeaker.shared.test()
            testing = false
        }
    }
}
