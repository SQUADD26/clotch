import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// One end of turn, said out loud (#50): the Stop payload → the answer's text → yes or no → Haiku → ElevenLabs.
/// Pure: the app (`VoiceSpeaker`) runs the processes, the network and the audio. Same rules as Clean View's `voce.ts`.
public enum VoiceTurn {
    public static let haikuModel = "claude-haiku-5-5"
    public static let haikuSeconds: TimeInterval = 8
    /// The ceiling of one spoken line (~25 s of speech) and of the cleaned report Haiku reads.
    public static let maxSpoken = 320
    /// The raw text cleaned at most: the answer's opening, where the report leads.
    static let maxRaw = 4000
    public static let fallback = "C’è una novità, guarda lo schermo."
    public static let testLine = "Ciao, questa è una prova della voce."
    /// ElevenLabs takes speed up to 1.2; the player does the rest.
    public static let apiMaxSpeed = 1.2

    public struct Config: Equatable {
        public var voiceId, model: String
        public var speed: Double
        public var maxCalls, maxDayChars: Int
        /// «Parla per» (`parla_per`): every session, only the main ones (no parent session), or only `sessione` (a local id).
        public var audience: Audience
        public var onlySession: String

        public enum Audience: String { case all = "tutte", main = "principali", one = "una" }

        /// A premade ElevenLabs voice, so a Mac with only the key set speaks.
        public static let defaultVoice = "JBFqnCBsd6RMkjVDRZzb"

        public init(_ c: [String: Any]) {
            let id = (c["voice_id"] as? String ?? "").trimmingCharacters(in: .whitespaces)
            voiceId = id.range(of: #"^[A-Za-z0-9_-]{6,64}$"#, options: .regularExpression) == nil ? Self.defaultVoice : id
            let m = c["model_id"] as? String ?? ""
            model = m.range(of: #"^[\w.-]{3,64}$"#, options: .regularExpression) == nil ? VoiceFiles.defaultModel : m
            speed = min(2.0, max(0.7, (c["speed"] as? NSNumber)?.doubleValue ?? VoiceFiles.defaultSpeed))
            maxCalls = (c["tetto_chiamate"] as? NSNumber)?.intValue ?? VoiceFiles.defaultMaxCalls
            maxDayChars = (c["tetto_caratteri"] as? NSNumber)?.intValue ?? VoiceFiles.defaultMaxChars
            audience = Audience(rawValue: c["parla_per"] as? String ?? "") ?? .main
            onlySession = c["sessione"] as? String ?? ""
        }

        /// Whether this end of turn is said. `sessions` = the Claude app's session files; the turn's `cliId` is found
        /// by its current or a prior CLI id. shortcut: a turn with no session file (a terminal `claude`) counts as main.
        public func speaks(cliId: String, sessions: [DesktopSession]) -> Bool {
            let s = sessions.filter { $0.cliId == cliId || $0.priorCliIds.contains(cliId) }
                .max { ($0.lastActivity ?? .distantPast) < ($1.lastActivity ?? .distantPast) }
            switch audience {
            case .all: return true
            case .main: return s?.parentLocalId == nil
            case .one: return s != nil && s?.localId == onlySession
            }
        }
    }

    /// `giorno.json`, the same file Clean View keeps: today's counters, reset each day.
    public struct Day: Codable, Equatable {
        public var giorno: String
        public var chiamate = 0
        public var caratteri = 0

        public static func key(_ now: Date) -> String {
            let c = Calendar.current.dateComponents([.year, .month, .day], from: now)
            return "\(c.year!)-\(c.month!)-\(c.day!)"
        }

        public static func load(_ data: Data?, now: Date) -> Day {
            let today = key(now)
            guard let data, let d = try? JSONDecoder().decode(Day.self, from: data), d.giorno == today else { return Day(giorno: today) }
            return d
        }
    }

    /// The session and the report for Haiku: the answer that closed the turn (`last_assistant_message`, else the last
    /// assistant message in the transcript's tail), cleaned for the ear and cut to `maxSpoken`.
    /// nil = nothing to say (no text, or Stop fired again by a blocking stop hook).
    public static func report(payload: Data, transcriptTail: (String) -> Data?) -> (session: String, text: String)? {
        guard let o = (try? JSONSerialization.jsonObject(with: payload)) as? [String: Any],
              o["stop_hook_active"] as? Bool != true else { return nil }
        let session = o["session_id"] as? String ?? ""
        var text = o["last_assistant_message"] as? String ?? ""
        if text.isEmpty, let path = o["transcript_path"] as? String, let tail = transcriptTail(path) {
            text = lastAssistantText(tail) ?? ""
        }
        text = cut(VoiceClean.clean(String(text.prefix(maxRaw))), maxSpoken)
        return text.isEmpty ? nil : (session, text)
    }

    /// The text blocks of the last `"type":"assistant"` line of a JSONL transcript tail.
    static func lastAssistantText(_ tail: Data) -> String? {
        for line in String(decoding: tail, as: UTF8.self).split(separator: "\n").reversed() {
            guard let o = (try? JSONSerialization.jsonObject(with: Data(line.utf8))) as? [String: Any],
                  o["type"] as? String == "assistant", let content = (o["message"] as? [String: Any])?["content"] else { continue }
            let text = (content as? String) ?? ((content as? [[String: Any]]) ?? [])
                .filter { $0["type"] as? String == "text" }.compactMap { $0["text"] as? String }.joined(separator: "\n")
            if !text.isEmpty { return text }
        }
        return nil
    }

    /// The first rule that says no wins; nil = speak.
    public static func refusal(isOn: Bool, hasKey: Bool, muted: Bool, day: Day, config: Config) -> String? {
        if !isOn { return "spenta" }
        if !hasKey { return "senza chiave" }
        if muted { return "sessione muta" }
        if day.chiamate >= config.maxCalls { return "tetto di chiamate del giorno" }
        if day.caratteri >= config.maxDayChars { return "tetto di caratteri del giorno" }
        return nil
    }

    /// `claude -p` as Clean View's parlatore runs it: no hooks or mods (safe mode), no tools, a cost ceiling.
    /// The report goes on stdin as data, never in the command line.
    public static func haikuArguments(prompt: String) -> [String] {
        ["-p", "--safe-mode", "--model", haikuModel, "--effort", "low", "--tools", "", "--no-session-persistence",
         "--max-budget-usd", "0.02", "--system-prompt", prompt]
    }

    public static func haikuInput(report: String, previousTopic: String) -> String {
        "<rapporto>\n\(report)\n</rapporto>\n" + (previousTopic.isEmpty ? "" : "<argomento_precedente>\(previousTopic)</argomento_precedente>\n")
    }

    /// What Haiku answered, cleaned again and ready to say, and its «ARGOMENTO:» line (kept for next time, never said).
    /// nil = say `fallback` (nothing left, or a secret Haiku made up or was tricked into).
    public static func spoken(fromHaiku output: String) -> (text: String, topic: String)? {
        var topic = ""
        let lines = output.split(separator: "\n", omittingEmptySubsequences: false).filter { line in
            let t = line.trimmingCharacters(in: .whitespaces)
            guard t.uppercased().hasPrefix("ARGOMENTO:") else { return true }
            topic = String(t.dropFirst("ARGOMENTO:".count)).trimmingCharacters(in: .whitespaces)
            return false
        }
        let raw = lines.joined(separator: "\n")
        guard !VoiceClean.hasSecret(raw) else { return nil }
        let text = VoiceClean.spoken(raw)
        guard !text.isEmpty else { return nil }
        return (cut(text, maxSpoken), String(VoiceClean.clean(topic).trimmingCharacters(in: CharacterSet(charactersIn: ". ")).prefix(120)))
    }

    /// Cut at the end of the last sentence that fits; one longer sentence is cut at a word.
    static func cut(_ t: String, _ max: Int) -> String {
        guard t.count > max else { return t }
        var out = ""
        for s in t.replacingOccurrences(of: #"([.!?])\s+"#, with: "$1\n", options: .regularExpression).split(separator: "\n") {
            let next = out.isEmpty ? String(s) : out + " " + s
            if next.count > max { break }
            out = next
        }
        if !out.isEmpty { return out }
        let w = String(t.prefix(max))
        return String(w[..<(w.lastIndex(of: " ") ?? w.endIndex)]) + "."
    }

    /// The ElevenLabs request: the key only in the `xi-api-key` header, never in the URL or the body.
    public static func speechRequest(text: String, config: Config, key: String) -> URLRequest {
        var r = URLRequest(url: URL(string: "https://api.elevenlabs.io/v1/text-to-speech/\(config.voiceId)?output_format=mp3_44100_64")!)
        r.httpMethod = "POST"
        r.timeoutInterval = 20
        r.setValue(key, forHTTPHeaderField: "xi-api-key")
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        r.setValue("audio/mpeg", forHTTPHeaderField: "Accept")
        let body: [String: Any] = ["text": text, "model_id": config.model, "voice_settings": ["speed": min(config.speed, apiMaxSpeed)]]
        r.httpBody = try? JSONSerialization.data(withJSONObject: body)
        return r
    }

    /// The player's rate for the speed above what ElevenLabs gives.
    public static func playbackRate(_ config: Config) -> Float { Float(config.speed / min(config.speed, apiMaxSpeed)) }
}
