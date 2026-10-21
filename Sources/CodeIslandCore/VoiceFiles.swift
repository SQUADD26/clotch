import Foundation

/// The files of Roberto's voice (Clean View, claude-config `global/bin/voce` and `clean-view/hooks/voce*.ts`), as the
/// «Voce» settings page reads and writes them (#38). The key is never read back: only whether it is there.
public struct VoiceFiles {
    public static let defaultModel = "eleven_v4_turbo"
    public static let defaultSpeed = 1.6       // voce-default.ts VELOCITA_DEFAULT
    public static let defaultMaxCalls = 300    // voce.ts DEFAULTS.maxCalls
    public static let defaultMaxChars = 60000  // voce.ts DEFAULTS.maxDayChars
    public static let speedRange = 0.7...2.0

    public let keyURL, configURL, offURL, promptURL, defaultPromptURL, command: URL

    public init(home: URL = FileManager.default.homeDirectoryForCurrentUser) {
        let voce = home.appendingPathComponent(".config/voce")
        keyURL = home.appendingPathComponent(".config/elevenlabs/api-key")
        configURL = voce.appendingPathComponent("config.json")
        offURL = voce.appendingPathComponent("spento")
        promptURL = voce.appendingPathComponent("prompt.md")
        defaultPromptURL = home.appendingPathComponent(".claude/mods/clean-view/hooks/voce-parlatore.md")
        command = home.appendingPathComponent(".claude/bin/voce")
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

    public var defaultPrompt: String { (try? String(contentsOf: defaultPromptURL, encoding: .utf8)) ?? "" }

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
    private func write(_ data: Data, to url: URL) throws {
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
