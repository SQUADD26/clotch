import AVFoundation
import Foundation
import os.log
import ClotchCore

/// Clotch's own voice (#50): with the switch on and a key set, a Stop hook in every Claude Code folder queues each end of
/// turn in `~/.config/voce/coda`; each one goes to the alerts engine (`VoiceAlertCenter`, #57), and only the news it lets
/// through is said here: Haiku → ElevenLabs → light on the notch edge → audio. The file `clotch`, touched every hour, tells the hook and Clean View's mod that Clotch speaks now
/// (contract in `VoiceHooks`).
@MainActor
final class VoiceSpeaker {
    static let shared = VoiceSpeaker()
    private static let log = Logger(subsystem: "com.squadd.clotch", category: "Voice")

    private let files = VoiceFiles()
    private let home = FileManager.default.homeDirectoryForCurrentUser
    private var source: DispatchSourceFileSystemObject?
    private var player: AVAudioPlayer?
    private var heartbeat: Timer?
    /// The one lowering of the other apps' audio running now (#83); a second speech while it runs does not start another tap.
    private var ducker: AudioDucker?

    func start() {
        refresh()
        VoiceAlertCenter.shared.start()
        watch()
        drain()
    }

    /// At quit: the hook and the mod see no live Clotch and stand aside. The hook entries stay, doing nothing.
    func stop() {
        heartbeat?.invalidate()
        try? FileManager.default.removeItem(at: files.activeURL)
        ducker?.end()  // the others' audio back at once, never left lowered by a quit
    }

    /// The hooks follow the switch and the key: on with a key = installed (once) in every Claude Code folder and the
    /// live sign written; otherwise both removed. Called at launch and by the «Voce» page on every change.
    func refresh() {
        let on = files.isOn && files.key != nil
        for dir in VoiceHooks.configDirs(home: home) { Self.setHook(on, in: dir.appendingPathComponent("settings.json").path) }
        let script = home.appendingPathComponent(VoiceHooks.scriptPath)
        if on {
            try? files.write(Data(VoiceHooks.script.utf8), to: script)
            try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: script.path)
            try? files.write(Data(), to: files.activeURL)
            heartbeat = heartbeat ?? Timer.scheduledTimer(withTimeInterval: 3600, repeats: true) { [files] _ in
                try? files.write(Data(), to: files.activeURL)
            }
        } else {
            heartbeat?.invalidate()
            heartbeat = nil
            try? FileManager.default.removeItem(at: files.activeURL)
            try? FileManager.default.removeItem(at: script)
        }
    }

    /// Minimal-diff edit of `hooks`, like Clotch's installer; a file that is not JSON is never touched.
    private static func setHook(_ on: Bool, in path: String) {
        let text = FileManager.default.contents(atPath: path).map { String(decoding: $0, as: UTF8.self) } ?? ""
        let blank = text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let parsed = (try? JSONSerialization.jsonObject(with: Data(text.utf8))) as? [String: Any]
        guard let settings = blank ? [String: Any]() : parsed else { return }
        let hooks = settings["hooks"] as? [String: Any] ?? [:]
        guard let changed = on ? VoiceHooks.adding(to: hooks) : VoiceHooks.removing(from: hooks),
              let merged = JSONMinimalEditor.setTopLevelValue(in: blank ? "{}\n" : text, key: "hooks", value: changed) else { return }
        _ = ConfigPathIdentity.write(Data(merged.utf8), to: path)
    }

    // MARK: - Queue

    private func watch() {
        try? FileManager.default.createDirectory(at: files.queueURL, withIntermediateDirectories: true)
        let fd = open(files.queueURL.path, O_EVTONLY)
        guard fd >= 0 else { return }
        let s = DispatchSource.makeFileSystemObjectSource(fileDescriptor: fd, eventMask: .write, queue: .main)
        s.setEventHandler { [weak self] in MainActor.assumeIsolated { self?.drain() } }
        s.setCancelHandler { close(fd) }
        s.resume()
        source = s
    }

    /// Takes every queued turn to the alerts engine. Older than two minutes (Clotch was busy or closed): dropped.
    private func drain() {
        let fm = FileManager.default
        let names = ((try? fm.contentsOfDirectory(atPath: files.queueURL.path)) ?? []).filter { $0.hasSuffix(".json") }.sorted()
        for name in names {
            let url = files.queueURL.appendingPathComponent(name)
            let data = try? Data(contentsOf: url)
            try? fm.removeItem(at: url)
            let age = Date().timeIntervalSince1970 - (Double(name.prefix { $0.isNumber }) ?? 0)
            if let data, age < 120 { VoiceAlertCenter.shared.stopped(data) }
        }
    }

    /// One piece of news the engine let through. The rules of the moment it is said: switch, key, muted session, daily caps.
    func say(_ event: VoiceEvent) async {
        guard !AfkFiles().isOn else { return }  // AFK (#106): Clotch is silent while Roberto is away
        let config = VoiceTurn.Config((try? files.readConfig()) ?? [:])
        var day = VoiceTurn.Day.load(try? Data(contentsOf: files.dayURL), now: Date())
        // No canonical prompt from the config (#84): silent, never a copy of it.
        guard let key = files.key, let prompt = files.prompt, VoiceTurn.refusal(isOn: files.isOn, hasKey: true, muted: files.isMuted(session: event.session),
                                                     day: day, config: config) == nil else { return }
        // Counted before the calls: a loop of failures never spends more than the cap.
        day.chiamate += 1
        saveDay(day)
        let input = VoiceTurn.haikuInput(report: event.report, context: event.context, previousTopic: lastTopic())
        guard let spoken = await VoiceTurn.line(haiku: { await Self.haiku(prompt: prompt, input: input, config: config) }) else {
            return Self.log.error("news not said: no usable line from Haiku (see ClaudeRun)")
        }
        let text = spoken.text
        day.caratteri += text.count
        saveDay(day)
        if await speak(text, config: config, key: key) == nil, !spoken.topic.isEmpty {
            let last: [String: Any] = ["argomento": spoken.topic, "frase": text, "t": Int(Date().timeIntervalSince1970 * 1000)]
            try? files.write(JSONSerialization.data(withJSONObject: last), to: files.lastURL)
        }
    }

    private func saveDay(_ day: VoiceTurn.Day) {
        if let data = day.merged(into: try? Data(contentsOf: files.dayURL)) { try? files.write(data, to: files.dayURL) }
    }

    private func lastTopic() -> String {
        guard let data = try? Data(contentsOf: files.lastURL) else { return "" }
        let last = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        // Like the mod: the topic of a line said more than a minute ago is no topic to follow (voce-io.ts:121).
        guard let t = last?["t"] as? Double, Date().timeIntervalSince1970 * 1000 - t < 60_000 else { return "" }
        return last?["argomento"] as? String ?? ""
    }

    /// The AFK summary on return (#106): its sentence as written, no Haiku; only with the switch on and a key.
    func sayAloud(_ text: String) async {
        guard files.isOn, let key = files.key else { return }
        _ = await speak(text, config: VoiceTurn.Config((try? files.readConfig()) ?? [:]), key: key)
    }

    /// «Prova voce»: one fixed sentence, no Haiku, even with the switch off.
    func test() async -> String {
        guard let key = files.key else { return Self.failed("Manca la chiave.") }
        return await speak(VoiceTurn.testLine, config: VoiceTurn.Config((try? files.readConfig()) ?? [:]), key: key) ?? "Voce provata."
    }

    /// The answer to a spoken question (#110): the voice and speed of Roberto's settings, no daily cap (he asked), even with the
    /// alerts switch off. nil = said; otherwise why not.
    func speakAnswer(_ text: String) async -> String? {
        guard let key = files.key else { return Self.failed("Manca la chiave.") }
        return await speak(text, config: VoiceTurn.Config((try? files.readConfig()) ?? [:]), key: key)
    }

    // MARK: - Haiku, ElevenLabs, audio, light

    /// ElevenLabs → light on → audio → light off. nil = said; otherwise why not, for the page.
    private func speak(_ text: String, config: VoiceTurn.Config, key: String) async -> String? {
        let request = VoiceTurn.speechRequest(text: text, config: config, key: key, pronunciation: files.pronunciation)
        let language = (try? JSONSerialization.jsonObject(with: request.httpBody ?? Data()) as? [String: Any])?["language_code"] as? String ?? "none"
        Self.log.notice("voice request: voice \(config.voiceId, privacy: .public), model \(config.model, privacy: .public), language \(language, privacy: .public)")
        guard let reply = try? await URLSession.shared.data(for: request) else { return Self.failed("ElevenLabs non risponde. Riprova.") }
        let data = reply.0
        let code = (reply.1 as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200, data.count > 500 else {
            return Self.failed(code == 401 ? "Chiave non valida. Controllala su ElevenLabs." : "ElevenLabs non ha dato audio (errore \(code)).")
        }
        let rate = VoiceTurn.playbackRate(config)
        guard let p = try? AVAudioPlayer(data: data) else { return Self.failed("Audio non leggibile. Riprova.") }
        p.enableRate = true
        p.rate = rate
        p.prepareToPlay()
        let levels = await Task.detached { Self.levels(data, rate: rate) }.value
        let length = p.duration / Double(rate)
        let ducking = config.duck && ducker == nil ? AudioDucker(level: config.duckLevel) : nil
        ducker = ducking
        defer { if ducker === ducking { ducker = nil } }
        // Others fall for `VoiceDuck.fadeDown` while the light lead runs, the voice at full volume, then they rise (see `VoiceDuck.around`).
        return await VoiceDuck.around(ducking, level: config.duckLevel, sleep: { _ = try? await Task.sleep(nanoseconds: UInt64($0 * 1e9)) }) {
            let id = UUID().uuidString
            let start = Date().addingTimeInterval(VoiceStatus.lead)
            writeStatus(id: id, speaking: true, start: start, end: start.addingTimeInterval(length), levels: levels)
            player = p
            try? await Task.sleep(nanoseconds: UInt64(VoiceStatus.lead * 1e9))
            p.play()
            try? await Task.sleep(nanoseconds: UInt64(length * 1e9))
            player = nil
            writeStatus(id: id, speaking: false, start: Date(), end: Date(), levels: [])
            Self.log.notice("voice said: \(text.count) chars, \(String(format: "%.1f", length), privacy: .public) s of audio")
            return nil
        }
    }

    /// Every voice that is not said lands in the log (#159): the news and the spoken answer have no page to show it on.
    private static func failed(_ why: String) -> String {
        log.error("voice not said: \(why, privacy: .public)")
        return why
    }

    /// `stato.json`, the contract the edge light reads (`NotchVoice.swift`).
    private func writeStatus(id: String, speaking: Bool, start: Date, end: Date, levels: [Double]) {
        let ms = { (d: Date) in Int(d.timeIntervalSince1970 * 1000) }
        let o: [String: Any] = ["v": 1, "id": id, "parla": speaking, "t_inizio": ms(start), "t_fine": ms(end), "passo_ms": 50, "livello": levels]
        try? files.write(JSONSerialization.data(withJSONObject: o), to: files.statusURL)
    }

    /// The voice volume (RMS 0…1) every 50 ms of playback, read from the mp3 before it plays.
    nonisolated private static func levels(_ mp3: Data, rate: Float) -> [Double] {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("clotch-voce-\(UUID().uuidString).mp3")
        defer { try? FileManager.default.removeItem(at: url) }
        guard (try? mp3.write(to: url)) != nil, let file = try? AVAudioFile(forReading: url),
              let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)),
              (try? file.read(into: buffer)) != nil, let samples = buffer.floatChannelData?[0] else { return [] }
        let count = Int(buffer.frameLength)
        let window = max(1, Int(file.processingFormat.sampleRate * 0.05 * Double(rate)))
        return stride(from: 0, to: count, by: window).prefix(4000).map { i in
            let n = min(window, count - i)
            var sum: Float = 0
            for j in i..<(i + n) { sum += samples[j] * samples[j] }
            return (min(1, Double(sum / Float(n)).squareRoot()) * 1000).rounded() / 1000
        }
    }

    /// `claude -p` with Haiku, the report on stdin, killed after `haikuSeconds`. nil = any failure, logged by `ClaudeRun`
    /// (`VoiceTurn.line` tries again, then stays silent: a news line has no bar to show it on).
    nonisolated private static func haiku(prompt: String, input: String, config: VoiceTurn.Config) async -> String? {
        try? await ClaudeRun.run(VoiceTurn.haikuArguments(prompt: prompt, config: config), input: input, timeout: VoiceTurn.haikuSeconds).get()
    }

    /// A Dock-launched app has no ~/.local/bin in PATH: the usual places, then the newest installed version.
    nonisolated static func claudeBinary() -> String? {
        let fm = FileManager.default
        let home = fm.homeDirectoryForCurrentUser.path
        if let found = [home + "/.local/bin/claude", "/opt/homebrew/bin/claude", "/usr/local/bin/claude"].first(where: fm.isExecutableFile(atPath:)) {
            return found
        }
        let versions = home + "/.local/share/claude/versions"
        let newest = ((try? fm.contentsOfDirectory(atPath: versions)) ?? []).map { versions + "/" + $0 }
            .max { ((try? fm.attributesOfItem(atPath: $0)[.modificationDate]) as? Date ?? .distantPast) < ((try? fm.attributesOfItem(atPath: $1)[.modificationDate]) as? Date ?? .distantPast) }
        return newest.flatMap { fm.isExecutableFile(atPath: $0) ? $0 : nil }
    }

    /// The last 256 KB of a transcript: enough for the last answer, never the whole file.
    nonisolated static func tail(_ path: String) -> Data? {
        guard let h = FileHandle(forReadingAtPath: path) else { return nil }
        defer { try? h.close() }
        let end = h.seekToEndOfFile()
        h.seek(toFileOffset: end > 262_144 ? end - 262_144 : 0)
        return h.readDataToEndOfFile()
    }
}
