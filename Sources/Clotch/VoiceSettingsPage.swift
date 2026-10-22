// figma: 91-64814
import SwiftUI
import AppKit
import ClotchCore

/// «Voce» (#38, #50, #57, Figma #95): on/off, «Parla per», other sounds, the two keys, voice, speed, daily limits, a test,
/// the sentence's model and its instructions, and the alerts. Files and rules live in `VoiceFiles`, the speaking in `VoiceSpeaker`;
/// the text is Italian like the rest of Clotch's own pages. Every change is saved at once: the page has no «Salva».
struct VoiceSettingsPage: View {
    private typealias T = FigmaToken.MacOS27GoldenGate
    private let files: VoiceFiles
    private let width: CGFloat?
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
    @State private var rewriterModel = VoiceTurn.models[0]
    @State private var rewriterEffort = VoiceTurn.efforts[0]
    @State private var duckPercent = VoiceDuck.defaultLevel * 100
    @State private var configBroken = false
    @State private var testing = false
    @State private var note: String?

    init(files: VoiceFiles = VoiceFiles(), width: CGFloat? = nil) {
        self.files = files
        self.width = width
    }

    var body: some View {
        SettingsCardPage(symbol: "waveform", tint: T.impostazioniIconaViola, title: "Voce",
                         summary: "La voce parla solo quando serve: richiesta fatta, obiettivo raggiunto o bloccato, domanda per te, rischio, avviso che hai chiesto. Prima Claude scrive una frase breve, poi ElevenLabs la legge con la voce scelta.",
                         width: width ?? ClotchSettingsWindow.width) {
            SettingsGroup {
                CardRow(title: "Voce accesa") {
                    CardSwitch(label: "Voce accesa", isOn: Binding(get: { isOn }, set: { on in
                        run("Voce non salvata") { try files.setOn(on) }
                        isOn = files.isOn
                        VoiceSpeaker.shared.refresh()
                    }))
                }
                CardDivider()
                CardRow(title: "Stato", note: hasPrompt ? nil : "Istruzioni della voce mancanti. La voce tace.") {
                    CardStatus(ok: key != nil, text: key == nil ? "Manca la chiave" : "Chiave salvata")
                }
                CardDivider()
                CardRow(title: "Parla per", note: "Principali: quelle aperte da te, non da un’altra sessione.") {
                    HStack(spacing: T.notchSpazio8) {
                        if audience == .one {
                            CardMenu(label: "Sessione", selection: Binding(get: { onlySession }, set: { onlySession = $0; saveAudience() }),
                                     options: sessionOptions, width: T.impostazioniMisura200)
                        }
                        CardMenu(label: "Parla per", selection: Binding(get: { audience }, set: { audience = $0; saveAudience() }),
                                 options: [(.all, "Tutte le sessioni"), (.main, "Solo le sessioni principali"), (.one, "Solo una sessione")],
                                 width: T.impostazioniMisura200)
                    }
                    .disabled(configBroken)
                }
                CardDivider()
                CardRow(title: "Abbassa l’audio mentre parla",
                        note: "Musica e video scendono mezzo secondo prima della voce. Al primo uso macOS chiede il permesso.") {
                    CardSwitch(label: "Abbassa l’audio mentre parla", isOn: Binding(get: { duck }, set: { duck = $0; saveDuck() }))
                        .disabled(configBroken)
                }
            }
            SettingsGroup(title: "Chiavi") {
                keyRow("Chiave ElevenLabs", masked: key, note: "Creala su elevenlabs.io, in Developers › API Keys. Resta solo su questo Mac.") {
                    try files.saveKey($0)
                }
                CardDivider()
                keyRow("Chiave Jev", masked: jevKey, note: "Prima di parlare, la voce chiede a Jev se la novità ti serve. Resta solo su questo Mac.") {
                    try files.saveJevKey($0)
                }
            }
            SettingsGroup(title: "Lettura") { reading }
            SettingsGroup(title: "Novità a voce") {
                CardRow(title: "Modello novità", note: "Legge a voce le novità delle sessioni. Il modello dell’Overseer si sceglie in Dettatura.") {
                    CardMenu(label: "Modello novità", selection: Binding(get: { rewriterModel }, set: { rewriterModel = $0; saveRewriter() }),
                             options: [("claude-haiku-5-5", "Haiku 5.5"), ("claude-sonnet-5-5", "Sonnet 5.5"), ("claude-opus-5-5", "Opus 5.5")])
                        .disabled(configBroken)
                }
                CardDivider()
                CardRow(title: "Ragionamento", note: "Più ragionamento: frase più curata, ma più lenta.") {
                    CardMenu(label: "Ragionamento", selection: Binding(get: { rewriterEffort }, set: { rewriterEffort = $0; saveRewriter() }),
                             options: [("low", "Basso"), ("medium", "Medio"), ("high", "Alto"), ("xhigh", "Molto alto"), ("max", "Massimo")])
                        .disabled(configBroken)
                }
                CardDivider()
                VoicePromptRow(note: $note, files: files)
            }
            SettingsGroup(title: "Avvisi") { VoiceAlertsSection(sessions: sessions, note: $note, files: files) }
            if let note { Text(note).font(.settings(T.notchTesto11)).foregroundStyle(T.testoSecondario).frame(maxWidth: .infinity, alignment: .trailing) }
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

    private var sessionOptions: [(String, String)] {
        sessions.isEmpty ? [("", "Nessuna sessione")] : sessions.map { ($0.localId, $0.title.isEmpty ? "Senza titolo" : $0.title) }
    }

    /// Voice, model, speed, limits and the test.
    @ViewBuilder private var reading: some View {
        CardRow(title: "ID voce") {
            CardField(width: T.impostazioniMisura260, fill: T.finestraFondo) {
                TextField("ID voce", text: $voiceId, prompt: Text("Lascia vuoto per la voce di serie").foregroundStyle(T.testoSecondario))
                    .textFieldStyle(.plain).font(.settings(T.notchTesto13)).onSubmit(saveConfig)
            }
        }
        .disabled(configBroken)
        CardDivider()
        CardRow(title: "Modello") {
            CardMenu(label: "Modello", selection: Binding(get: { model }, set: { model = $0; saveConfig() }),
                     options: Self.models.map { ($0.0, $0.1) } + (Self.models.contains { $0.0 == model } ? [] : [(model, model)]))
                .disabled(configBroken)
        }
        CardDivider()
        CardRow(title: "Velocità") {
            HStack(spacing: T.notchSpazio10) {
                CardSlider(value: $speed, range: VoiceFiles.speedRange, step: 0.05, label: "Velocità", onEnd: saveConfig)
                Text(times(speed)).font(.settings(T.notchTesto13)).foregroundStyle(T.testoPrimario).monospacedDigit()
            }
            .disabled(configBroken)
        }
        CardDivider()
        CardRow(title: "Limiti al giorno",
                note: configBroken ? "Impostazioni illeggibili. Correggi a mano il file config.json della voce." : "Oltre i limiti la voce tace fino a domani.") {
            HStack(spacing: T.notchSpazio8) {
                CardField(width: T.impostazioniMisura60) {
                    TextField("Frasi al giorno", value: $maxCalls, format: .number).textFieldStyle(.plain).font(.settings(T.notchTesto13)).onSubmit(saveConfig)
                }
                Text("frasi").font(.settings(T.notchTesto13)).foregroundStyle(T.testoPrimario)
                CardField(width: T.impostazioniMisura80) {
                    TextField("Caratteri al giorno", value: $maxChars, format: .number).textFieldStyle(.plain).font(.settings(T.notchTesto13)).onSubmit(saveConfig)
                }
                Text("caratteri").font(.settings(T.notchTesto13)).foregroundStyle(T.testoPrimario)
            }
            .disabled(configBroken)
        }
        CardDivider()
        CardRow(title: "Prova") {
            CardButton(title: testing ? "Prova in corso…" : "Prova voce", action: test).disabled(testing || configBroken)
        }
    }

    /// A saved key shows as dots and its last 4 characters; «Incolla chiave» saves what is on the clipboard.
    private func keyRow(_ label: String, masked: String?, note: String, save: @escaping (String) throws -> Void) -> some View {
        CardStackRow(title: label, note: note) {
            HStack(spacing: T.notchSpazio8) {
                CardField(width: T.impostazioniMisura260, fill: masked == nil ? T.finestraFondo : T.selezioneFondo) {
                    Text(masked ?? "Chiave non salvata").font(.settings(T.notchTesto13))
                        .foregroundStyle(masked == nil ? T.testoSecondario : T.testoPrimario).lineLimit(1)
                }
                .accessibilityElement(children: .combine).accessibilityLabel(Text(label))
                CardButton(title: "Incolla chiave") {
                    let pasted = NSPasteboard.general.string(forType: .string)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                    guard pasted.count >= 8 else { self.note = "Negli appunti non c’è una chiave."; return }
                    run("Chiave non salvata", done: "Chiave salvata") { try save(pasted) }
                    load()
                    VoiceSpeaker.shared.refresh()
                }
            }
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
        rewriterModel = parsed.rewriterModel
        rewriterEffort = parsed.rewriterEffort
    }

    private func saveDuck() {
        run("Impostazioni non salvate") {
            try files.updateConfig(["abbassa_audio": duck, "abbassa_livello": Int(duckPercent)])
        }
    }

    private func saveRewriter() {
        run("Impostazioni non salvate") {
            try files.updateConfig(["riscrittore_modello": rewriterModel, "riscrittore_ragionamento": rewriterEffort])
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
