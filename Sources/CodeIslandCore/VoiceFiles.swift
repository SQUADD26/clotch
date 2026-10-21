import Foundation

/// The files of the voice, shared with Clean View (claude-config `global/bin/voce`, `clean-view/hooks/voce*.ts`): the «Voce»
/// settings page (#38) and Clotch's own speaker (#50) read and write them. The page never reads the key back, only whether it is there.
public struct VoiceFiles {
    public static let defaultModel = "eleven_v4_turbo"
    public static let defaultSpeed = 1.6       // voce-default.ts VELOCITA_DEFAULT
    public static let defaultMaxCalls = 300    // voce.ts DEFAULTS.maxCalls
    public static let defaultMaxChars = 60000  // voce.ts DEFAULTS.maxDayChars
    public static let speedRange = 0.7...2.0

    public let keyURL, configURL, offURL, promptURL, dayURL, lastURL, statusURL, activeURL, queueURL, eventsURL, alertsURL, voiceDir: URL

    public init(home: URL = FileManager.default.homeDirectoryForCurrentUser) {
        let voce = home.appendingPathComponent(".config/voce")
        keyURL = home.appendingPathComponent(".config/elevenlabs/api-key")
        configURL = voce.appendingPathComponent("config.json")
        offURL = voce.appendingPathComponent("spento")
        promptURL = voce.appendingPathComponent("prompt.md")
        dayURL = voce.appendingPathComponent("giorno.json")
        lastURL = voce.appendingPathComponent("ultima.json")
        statusURL = voce.appendingPathComponent("stato.json")
        activeURL = voce.appendingPathComponent("clotch")  // contract with Clean View: see VoiceHooks
        queueURL = voce.appendingPathComponent("coda")
        eventsURL = voce.appendingPathComponent("eventi.jsonl")  // claude-config#1854 writes it; Clotch only reads
        alertsURL = voce.appendingPathComponent("avvisi.json")   // «Avvisami quando…»: the page and `avvisami` write it
        voiceDir = voce
    }

    public var hasKey: Bool { ((try? Data(contentsOf: keyURL))?.isEmpty == false) }

    public func saveKey(_ key: String) throws {
        try write(Data(key.trimmingCharacters(in: .whitespacesAndNewlines).utf8), to: keyURL)
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

    /// The instructions Haiku follows before the voice speaks: prompt.md when it has text, else the stock ones.
    public var prompt: String {
        let own = (try? String(contentsOf: promptURL, encoding: .utf8)) ?? ""
        return own.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? defaultPrompt : own
    }

    public var defaultPrompt: String { VoicePrompt.stock }

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

    /// Empty text or the stock text removes prompt.md, so the stock instructions apply (and their updates reach Roberto).
    public func savePrompt(_ text: String) throws {
        let blank = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if blank.isEmpty || blank == defaultPrompt.trimmingCharacters(in: .whitespacesAndNewlines) {
            if FileManager.default.fileExists(atPath: promptURL.path) { try FileManager.default.removeItem(at: promptURL) }
        } else {
            try write(Data(text.utf8), to: promptURL)
        }
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
