import Foundation

/// The files of the voice, shared with the engine and Clean View (claude-config `global/bin/voce`, `clean-view/hooks/voce*.ts`): the «Voce»
/// settings page (#38) and Clotch's own speaker (#50) read and write them. The page never reads the key back, only whether it is there.
public struct VoiceFiles {
    public static let defaultModel = "eleven_v4_turbo"
    public static let defaultSpeed = 1.6       // voce-default.ts VELOCITA_DEFAULT
    public static let defaultMaxCalls = 300    // voce.ts DEFAULTS.maxCalls
    public static let defaultMaxChars = 60000  // voce.ts DEFAULTS.maxDayChars
    public static let speedRange = 0.7...2.0

    public let keyURL, configURL, offURL, promptURL, ownPromptURL, pronunciationURL, basePronunciationURL, judgeQuestionURL, helperPromptURL,dayURL, lastURL, statusURL, activeURL, queueURL, eventsURL, alertsURL, judgeLogURL, jevKeyURL, seenURL, voiceDir: URL

    public init(home: URL = FileManager.default.homeDirectoryForCurrentUser) {
        let voce = home.appendingPathComponent(".config/voce")
        keyURL = home.appendingPathComponent(".config/elevenlabs/api-key")
        configURL = voce.appendingPathComponent("config.json")
        offURL = voce.appendingPathComponent("spento")
        // The engine's own files (#84, #251): read, never copied or written. They live in ~/.claude/hooks since claude-config#1998;
        // an engine installed before that still has them in Clean View's mod folder.
        let motore = home.appendingPathComponent(".claude/hooks")
        let mod = home.appendingPathComponent(".claude/mods/clean-view/hooks")
        func engineFile(_ name: String) -> URL {
            let url = motore.appendingPathComponent(name)
            return FileManager.default.fileExists(atPath: url.path) ? url : mod.appendingPathComponent(name)
        }
        promptURL = engineFile("voce-parlatore.md")
        ownPromptURL = voce.appendingPathComponent("istruzioni.md")  // Roberto's own, from the page (#95); wins over the config's
        basePronunciationURL = engineFile("voce-pronuncia.json")
        pronunciationURL = voce.appendingPathComponent("pronuncia.json")
        judgeQuestionURL = home.appendingPathComponent(".claude/hooks/voce_giudice_domanda.txt")  // the same question as `voce_giudice.py`
        helperPromptURL = home.appendingPathComponent(VoiceRoute.helperPromptPath)  // claude-config#2116: the voice helper's instructions
        dayURL = voce.appendingPathComponent("giorno.json")
        lastURL = voce.appendingPathComponent("ultima.json")
        statusURL = voce.appendingPathComponent("stato.json")
        activeURL = voce.appendingPathComponent("clotch")  // contract with Clean View: see VoiceHooks
        queueURL = voce.appendingPathComponent("coda")
        eventsURL = voce.appendingPathComponent("eventi.jsonl")  // claude-config#1854 writes it; Clotch only reads
        alertsURL = voce.appendingPathComponent("avvisi.json")   // «Avvisami quando…»: the page and `avvisami` write it
        seenURL = voce.appendingPathComponent("clotch-detti.json")  // the alert engine's memory of what it let through (#202)
        judgeLogURL = voce.appendingPathComponent("giudice-log.jsonl")
        jevKeyURL = home.appendingPathComponent(".config/jev/api-key")  // the same key as claude-config's command judge
        voiceDir = voce
        overseerURL = home.appendingPathComponent(".claude/overseer/attuale.json")
    }

    /// Orders for the Overseer (#110): one file each, see `VoiceRoute`. `.ascolta` is the mod's sign that it reads them.
    public var inboxURL: URL { voiceDir.appendingPathComponent(VoiceRoute.inboxFolder) }
    public var inboxListenerURL: URL { inboxURL.appendingPathComponent(".ascolta") }
    /// The engine's outcome of each order, `<same file name>` inside (#262, see `VoiceRoute.delivery`).
    public var outcomesURL: URL { inboxURL.appendingPathComponent(".esiti") }
    public let overseerURL: URL

    public var hasKey: Bool { ((try? Data(contentsOf: keyURL))?.isEmpty == false) }

    public func saveKey(_ key: String) throws {
        try write(Data(key.trimmingCharacters(in: .whitespacesAndNewlines).utf8), to: keyURL)
    }

    public var hasJevKey: Bool { jevKey != nil }

    /// What the page shows of a saved key: dots and its last 4 characters (#95), nil when none is saved.
    public func masked(_ url: URL) -> String? {
        let k = ((try? String(contentsOf: url, encoding: .utf8)) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return k.count < 8 ? nil : String(repeating: "•", count: 12) + k.suffix(4)
    }

    public func saveJevKey(_ key: String) throws {
        try write(Data(key.trimmingCharacters(in: .whitespacesAndNewlines).utf8), to: jevKeyURL)
    }

    /// The judge's key, for the judge only: trimmed, nil when missing or empty.
    public var jevKey: String? {
        let k = ((try? String(contentsOf: jevKeyURL, encoding: .utf8)) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return k.isEmpty || k.contains(where: \.isWhitespace) ? nil : k
    }

    /// The voice is on unless `spento` exists (`voce off`).
    public var isOn: Bool { !FileManager.default.fileExists(atPath: offURL.path) }

    public func setOn(_ on: Bool) throws {
        if on {
            try? FileManager.default.removeItem(at: offURL)
        } else {
            try write(Data(), to: offURL)
        }
    }

    /// config.json as an object; missing = empty. Throws when it is there but not a JSON object, so a save never
    /// overwrites a file Roberto must fix by hand (same rule as `voce velocita`).
    public func readConfig() throws -> [String: Any] {
        guard let data = try? Data(contentsOf: configURL) else { return [:] }
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw CocoaError(.fileReadCorruptFile)
        }
        return object
    }

    /// Writes only these keys; every other field of config.json stays as it was.
    public func updateConfig(_ changes: [String: Any]) throws {
        let merged = try readConfig().merging(changes) { _, new in new }
        try write(JSONSerialization.data(withJSONObject: merged, options: [.prettyPrinted, .sortedKeys]), to: configURL)
    }

    /// The instructions Haiku follows: Roberto's own `istruzioni.md` when he wrote one (#95), else the config's canonical
    /// `voce-parlatore.md` (#84). nil (both missing or empty) = the voice is silent.
    public var prompt: String? { text(ownPromptURL) ?? text(promptURL) }

    /// True when the page's own instructions are in use: «Ripristina predefinito» has something to undo.
    public var hasOwnPrompt: Bool { text(ownPromptURL) != nil }

    /// Saves Roberto's instructions; the same text as the config's, or empty, removes his copy so config updates reach him again.
    public func savePrompt(_ prompt: String) throws {
        let t = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, t != text(promptURL) else { return try resetPrompt() }
        try write(Data((t + "\n").utf8), to: ownPromptURL)
    }

    /// Back to the config's instructions.
    public func resetPrompt() throws {
        if FileManager.default.fileExists(atPath: ownPromptURL.path) { try FileManager.default.removeItem(at: ownPromptURL) }
    }

    /// The judge's question: the config's `voce_giudice_domanda.txt` (#84). nil = the judge is not asked.
    public var judgeQuestion: String? { text(judgeQuestionURL) }

    private func text(_ url: URL) -> String? {
        let t = ((try? String(contentsOf: url, encoding: .utf8)) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    /// How words are said (`{"parola": "come si dice"}`): the config's base list, then Roberto's `pronuncia.json` on top.
    /// A missing or broken file counts as empty; an entry that is not text is skipped.
    public var pronunciation: [String: String] {
        let read = { (u: URL) in ((try? Data(contentsOf: u)).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? [:])
            .compactMapValues { $0 as? String } }
        return read(basePronunciationURL).merging(read(pronunciationURL)) { _, own in own }
    }

    /// The key, for the speaker only: trimmed, nil when missing or not shaped like a key.
    public var key: String? {
        let k = ((try? String(contentsOf: keyURL, encoding: .utf8)) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return k.range(of: #"^[A-Za-z0-9_-]{10,200}$"#, options: .regularExpression) == nil ? nil : k
    }

    /// `voce muto <id>` silences one session.
    public func isMuted(session: String) -> Bool {
        let id = session.filter { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }
        return !id.isEmpty && FileManager.default.fileExists(atPath: voiceDir.appendingPathComponent("muto-" + id).path)
    }

    /// One write in append, file 600 (a log line): two writers never mix their lines. Best effort.
    public func append(_ data: Data, to url: URL) {
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let fd = open(url.path, O_WRONLY | O_APPEND | O_CREAT, 0o600)
        guard fd >= 0 else { return }
        FileHandle(fileDescriptor: fd, closeOnDealloc: true).write(data)
    }

    /// Read, change and write one shared file under the flock the engine takes on `lock` (claude-config `avvisi.lock`):
    /// neither side loses the other's update. `change` returns nil to leave the file as it is. Blocks while the engine holds it (a few ms).
    @discardableResult
    public func modify(_ url: URL, lock: String, _ change: (Data?) -> Data?) throws -> Data? {
        try FileManager.default.createDirectory(at: voiceDir, withIntermediateDirectories: true)
        let fd = open(voiceDir.appendingPathComponent(lock).path, O_WRONLY | O_CREAT, 0o600)
        guard fd >= 0 else { throw CocoaError(.fileWriteUnknown) }
        defer { close(fd) }
        flock(fd, LOCK_EX)
        defer { flock(fd, LOCK_UN) }
        guard let next = change(try? Data(contentsOf: url)) else { return nil }
        try write(next, to: url)
        return next
    }

    /// Atomic write, file 600 and folder 700 (the key and its neighbours are never readable by others).
    public func write(_ data: Data, to url: URL) throws {
        let fm = FileManager.default
        let dir = url.deletingLastPathComponent()
        try fm.createDirectory(at: dir, withIntermediateDirectories: true)
        try fm.setAttributes([.posixPermissions: 0o700], ofItemAtPath: dir.path)
        let tmp = dir.appendingPathComponent(".\(url.lastPathComponent).tmp")
        guard fm.createFile(atPath: tmp.path, contents: data, attributes: [.posixPermissions: 0o600]) else {
            throw CocoaError(.fileWriteUnknown)
        }
        try fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: tmp.path)
        guard rename(tmp.path, url.path) == 0 else { throw CocoaError(.fileWriteUnknown) }
    }
}
