import SwiftUI
import CodeIslandCore

/// «Voce» (#38): set up Roberto's voice (Clean View): ElevenLabs key, on/off, voice, speed, daily limits, Haiku's
/// instructions, a test. Files and rules live in `VoiceFiles`; the text is Italian like the rest of Clotch's own pages.
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
    @State private var configBroken = false
    @State private var testing = false
    @State private var note: String?

    var body: some View {
        Form {
            Section {
                Text("L'Overseer ti dice a voce cosa è successo. Prima un aiutante Claude Haiku riscrive il messaggio in una frase breve, con le istruzioni qui sotto. Poi ElevenLabs la legge con la voce scelta.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                Toggle("Voce accesa", isOn: Binding(get: { isOn }, set: { on in
                    run("Voce non salvata") { try files.setOn(on) }
                    isOn = files.isOn
                }))
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
                    }
                    .disabled(newKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            } header: {
                Text("Chiave ElevenLabs")
            } footer: {
                Text("Creala su elevenlabs.io, in Developers › API Keys. Resta solo su questo Mac.")
            }

            Section {
                TextField("ID voce", text: $voiceId, prompt: Text("Copia da ElevenLabs › Voices"))
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

    /// `voce prova` with the values on screen: save first, then the command speaks one sentence (even with the voice off).
    private func test() {
        if !configBroken { saveConfig() }
        testing = true
        let command = files.command.path
        Task {
            note = await Self.prova(command)
            testing = false
        }
    }

    /// The last line `voce prova` prints («detta: …» or what is missing), off the main thread.
    private nonisolated static func prova(_ command: String) async -> String {
        guard FileManager.default.fileExists(atPath: command) else {
            return "Comando della voce non trovato. Installa la voce di Clean View."
        }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/bash")
        process.arguments = [command, "prova"]
        var env = ProcessInfo.processInfo.environment
        // ffmpeg (speed above 1.2) lives in Homebrew, which a Dock-launched app does not have in PATH.
        env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
        process.environment = env
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        guard (try? process.run()) != nil else { return "Prova non riuscita. Riprova." }
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        return String(decoding: data, as: UTF8.self).split(separator: "\n").last.map(String.init) ?? ""
    }
}
