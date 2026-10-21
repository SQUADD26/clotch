import SwiftUI
import ClotchCore

/// «Voce» (#38, #50): Clotch's voice: ElevenLabs key, on/off, voice, speed, daily limits, Haiku's instructions, a test.
/// Files and rules live in `VoiceFiles`, the speaking in `VoiceSpeaker`; the text is Italian like the rest of Clotch's own pages.
struct VoiceSettingsPage: View {
    private let files = VoiceFiles()

    @State private var isOn = true
    @State private var hasKey = false
    @State private var newKey = ""
    @State private var voiceId = ""
    @State private var model = VoiceFiles.defaultModel
    @State private var speed = VoiceFiles.defaultSpeed
    @State private var maxCalls = VoiceFiles.defaultMaxCalls
    @State private var maxChars = VoiceFiles.defaultMaxChars
    @State private var prompt = ""
    @State private var audience = VoiceTurn.Config.Audience.main
    @State private var onlySession = ""
    @State private var sessions: [DesktopSession] = []
    @State private var configBroken = false
    @State private var testing = false
    @State private var note: String?

    var body: some View {
        Form {
            Section {
                Text("A fine turno Claude ti dice a voce cosa ha fatto. Prima un aiutante Claude Haiku riscrive la risposta in una frase breve, con le istruzioni qui sotto. Poi ElevenLabs la legge con la voce scelta.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                Toggle("Voce accesa", isOn: Binding(get: { isOn }, set: { on in
                    run("Voce non salvata") { try files.setOn(on) }
                    isOn = files.isOn
                    VoiceSpeaker.shared.refresh()
                }))
            }

            Section {
                Picker("Parla per", selection: Binding(get: { audience }, set: { audience = $0; saveAudience() })) {
                    Text("Tutte le sessioni").tag(VoiceTurn.Config.Audience.all)
                    Text("Solo le sessioni principali").tag(VoiceTurn.Config.Audience.main)
                    Text("Solo una sessione").tag(VoiceTurn.Config.Audience.one)
                }
                .disabled(configBroken)
                if audience == .one {
                    Picker("Sessione", selection: Binding(get: { onlySession }, set: { onlySession = $0; saveAudience() })) {
                        if sessions.isEmpty { Text("Nessuna sessione").tag("") }
                        ForEach(sessions, id: \.localId) { s in
                            Text(s.title.isEmpty ? "Senza titolo" : s.title).tag(s.localId)
                        }
                    }
                    .disabled(configBroken)
                }
            } header: {
                Text("Sessioni")
            } footer: {
                Text("Principali: quelle aperte da te, non da un'altra sessione.")
            }

            Section {
                LabeledContent("Stato") {
                    Text(hasKey ? "Chiave salvata" : "Manca la chiave")
                        .foregroundStyle(hasKey ? Color.secondary : Color.orange)
                }
                HStack {
                    SecureField("Incolla chiave", text: $newKey)
                    Button("Salva") {
                        run("Chiave non salvata", done: "Chiave salvata") { try files.saveKey(newKey) }
                        newKey = ""
                        hasKey = files.hasKey
                        VoiceSpeaker.shared.refresh()
                    }
                    .disabled(newKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            } header: {
                Text("Chiave ElevenLabs")
            } footer: {
                Text("Creala su elevenlabs.io, in Developers › API Keys. Resta solo su questo Mac.")
            }

            Section {
                TextField("ID voce", text: $voiceId, prompt: Text("Lascia vuoto per la voce di serie"))
                TextField("Modello", text: $model)
                LabeledContent("Velocità") {
                    HStack {
                        Slider(value: $speed, in: VoiceFiles.speedRange, step: 0.05)
                        Text(String(format: "%.2f×", speed))
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .frame(width: 44, alignment: .trailing)
                    }
                }
                TextField("Frasi al giorno", value: $maxCalls, format: .number)
                TextField("Caratteri al giorno", value: $maxChars, format: .number)
                HStack {
                    Button(testing ? "Prova in corso..." : "Prova voce", action: test).disabled(testing)
                    Spacer()
                    Button("Salva", action: saveConfig).disabled(configBroken)
                }
            } header: {
                Text("Lettura")
            } footer: {
                Text(configBroken
                     ? "Impostazioni illeggibili. Correggi a mano il file config.json della voce."
                     : "Oltre i limiti del giorno la voce tace fino a domani.")
            }

            Section {
                TextEditor(text: $prompt)
                    .font(.system(size: 12, design: .monospaced))
                    .frame(minHeight: 220)
                HStack {
                    Button("Ripristina") {
                        run("Istruzioni non salvate", done: "Istruzioni ripristinate") { try files.savePrompt("") }
                        prompt = files.prompt
                    }
                    Spacer()
                    Button("Salva") {
                        run("Istruzioni non salvate", done: "Istruzioni salvate") { try files.savePrompt(prompt) }
                    }
                }
            } header: {
                Text("Istruzioni di Haiku")
            } footer: {
                Text("Con il testo vuoto valgono le istruzioni di serie.")
            }

            if let note {
                Text(note).font(.system(size: 12)).foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .onAppear(perform: load)
        .task {
            // The open ones, newest first; the chosen one stays listed even when archived.
            sessions = await GoalStore.shared.allSessions()
                .filter { !$0.isArchived || $0.localId == onlySession }
                .sorted { ($0.lastActivity ?? .distantPast) > ($1.lastActivity ?? .distantPast) }
        }
    }

    private func load() {
        isOn = files.isOn
        hasKey = files.hasKey
        prompt = files.prompt
        guard let config = try? files.readConfig() else { configBroken = true; return }
        voiceId = config["voice_id"] as? String ?? ""
        model = config["model_id"] as? String ?? VoiceFiles.defaultModel
        speed = min(max((config["speed"] as? NSNumber)?.doubleValue ?? VoiceFiles.defaultSpeed, 0.7), 2.0)
        maxCalls = (config["tetto_chiamate"] as? NSNumber)?.intValue ?? VoiceFiles.defaultMaxCalls
        maxChars = (config["tetto_caratteri"] as? NSNumber)?.intValue ?? VoiceFiles.defaultMaxChars
        let parsed = VoiceTurn.Config(config)
        audience = parsed.audience
        onlySession = parsed.onlySession
    }

    private func saveAudience() {
        run("Impostazioni non salvate", done: "Impostazioni salvate") {
            try files.updateConfig(["parla_per": audience.rawValue, "sessione": onlySession])
        }
    }

    private func saveConfig() {
        run("Impostazioni non salvate", done: "Impostazioni salvate") {
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
        do { try write(); note = done } catch { note = "\(failure). Riprova." }
    }

    /// Saves the values on screen, then says one fixed sentence with them (even with the voice off).
    private func test() {
        if !configBroken { saveConfig() }
        testing = true
        Task {
            note = await VoiceSpeaker.shared.test()
            testing = false
        }
    }
}
