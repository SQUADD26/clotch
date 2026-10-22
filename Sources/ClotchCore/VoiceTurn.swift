import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// One piece of news said out loud (#50, #57): the event's report → yes or no → Haiku → ElevenLabs.
/// Pure: the app (`VoiceSpeaker`) runs the processes, the network and the audio. Same rules as Clean View's `voce.ts`.
public enum VoiceTurn {
    /// The models and effort levels the rewriter may run with (#96); `claude --effort` takes exactly these levels.
    public static let models = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"]
    public static let efforts = ["low", "medium", "high", "xhigh", "max"]
    /// Haiku gets this long per try, two tries (#73); then the voice is silent (#84).
    public static let haikuSeconds: TimeInterval = 22
    public static let haikuTries = 2
    /// The ceiling of one spoken line (~25 s of speech) and of the cleaned report Haiku reads.
    public static let maxSpoken = 320
    /// The raw text cleaned at most: the answer's opening, where the report leads.
    static let maxRaw = 4000
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
        /// «Abbassa l'audio mentre parlo» (`abbassa_audio`, off by default: the first use asks macOS for a permission) and how
        /// much of their volume the other apps keep meanwhile (`abbassa_livello`, percent).
        public var duck: Bool
        public var duckLevel: Double
        /// The model that writes the spoken line and its effort (`riscrittore_modello`, `riscrittore_ragionamento`, #96).
        public var rewriterModel, rewriterEffort: String

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
            duck = c["abbassa_audio"] as? Bool ?? false
            let percent = (c["abbassa_livello"] as? NSNumber)?.doubleValue ?? VoiceDuck.defaultLevel * 100
            duckLevel = min(VoiceDuck.levelRange.upperBound, max(VoiceDuck.levelRange.lowerBound, percent / 100))
            rewriterModel = VoiceTurn.models.first { $0 == c["riscrittore_modello"] as? String } ?? VoiceTurn.models[0]
            rewriterEffort = VoiceTurn.efforts.first { $0 == c["riscrittore_ragionamento"] as? String } ?? VoiceTurn.efforts[0]
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

        /// The file with this day's counters over what Clean View keeps in it (`recenti`, `avvisato`, `ultimo`): not ours to drop.
        public func merged(into data: Data?) -> Data? {
            var o = (data.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any]) ?? [:]
            if o["giorno"] as? String != giorno { o["ultimo"] = nil }  // a new day: like Clean View, counters restart, `recenti` and `avvisato` stay
            o["giorno"] = giorno; o["chiamate"] = chiamate; o["caratteri"] = caratteri
            return try? JSONSerialization.data(withJSONObject: o)
        }

        public static func load(_ data: Data?, now: Date) -> Day {
            let today = key(now)
            guard let data, let d = try? JSONDecoder().decode(Day.self, from: data), d.giorno == today else { return Day(giorno: today) }
            return d
        }
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
    public static func haikuArguments(prompt: String, config: Config) -> [String] {
        ["-p", "--safe-mode", "--model", config.rewriterModel, "--effort", config.rewriterEffort, "--tools", "", "--no-session-persistence",
         "--max-budget-usd", "0.02", "--system-prompt", prompt]
    }

    /// The input Clean View's parlatore gives Haiku (voce-parlatore.ts:100). `dire_argomento` = the line must say what it is
    /// about: there is no recent topic to follow (#204).
    public static func haikuInput(report: String, context: String = "", previousTopic: String) -> String {
        "<ruolo>\(role)</ruolo>\n<rapporto>\n\(report)\n</rapporto>\n" + (context.isEmpty ? "" : "<contesto>\(context)</contesto>\n")
            + "<dire_argomento>\(previousTopic.isEmpty ? "sì" : "no")</dire_argomento>\n"
            + (previousTopic.isEmpty ? "" : "<argomento_precedente>\(previousTopic)</argomento_precedente>\n")
    }

    /// The line to say (#73): Haiku up to `haikuTries` times, each cut at `timeout`. When both fail: nil, silence (#84,
    /// claude-config#1837: never the raw or cleaned report, never a fixed sentence).
    public static func line(timeout: TimeInterval = haikuSeconds, subject: String = "",
                            haiku: @escaping @Sendable () async -> String?) async -> (text: String, topic: String)? {
        for _ in 0..<haikuTries {
            let out: String? = await withTaskGroup(of: String?.self) { g in
                g.addTask { await haiku() }
                g.addTask { try? await Task.sleep(nanoseconds: UInt64(timeout * 1e9)); return nil }
                let first = await g.next() ?? nil
                g.cancelAll()
                return first
            }
            if let out, let said = spoken(fromHaiku: out), !vague(said.text, subject: subject), !selfAnswered(said.text) { return said }
        }
        return nil
    }

    /// What Haiku answered, cleaned again and ready to say, and its «ARGOMENTO:» line (kept for next time, never said).
    /// nil = a failed try (nothing left, or a secret Haiku made up or was tricked into).
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

    /// The pronunciation list applied (`VoiceFiles.pronunciation`), as claude-config `voce-pronuncia.ts` does: whole words,
    /// the longest key first, one pass (a replacement is never read again); an all-capitals key (a sigla) matches capitals
    /// only («CI» yes, «ci vediamo» stays), any other key matches in any case.
    public static func pronounced(_ text: String, _ words: [String: String]) -> String {
        let keys = words.keys.filter { !$0.isEmpty }.sorted { $0.utf16.count > $1.utf16.count }
        let alternatives = keys.map { "(" + NSRegularExpression.escapedPattern(for: $0) + ")" }.joined(separator: "|")
        guard !keys.isEmpty, let re = try? NSRegularExpression(pattern: #"(?<![\p{L}\p{N}])(?:"# + alternatives + #")(?![\p{L}\p{N}])"#,
                                                               options: .caseInsensitive) else { return text }
        let ns = text as NSString
        var out = "", last = 0
        for m in re.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            let found = ns.substring(with: m.range)
            let k = keys[(1...keys.count).first { m.range(at: $0).location != NSNotFound }! - 1]
            let sigla = k == k.uppercased() && k.contains(where: \.isLetter)
            out += ns.substring(with: NSRange(location: last, length: m.range.location - last)) + (sigla && found != k ? found : words[k]!)
            last = m.range.location + m.range.length
        }
        return out + ns.substring(from: last)
    }

    /// No word is forced to English (Roberto, #312: «ho chiesto che NON venga pronunciato in francese»): the voice reads Italian
    /// and names as an Italian would. Only the old name becomes the new one, in titles and subjects too.
    public static let builtInPronunciation: [String: String] = ["Overseer": "Friday"]

    /// The voice's name: ONE place (#299), Roberto will pick another.
    public static let voiceName = "Friday"

    /// Who speaks (#299): Roberto's right hand, not a loudspeaker for the sessions' sentences.
    static let role = "Sei \(voiceName), il braccio destro di Roberto: tieni in mano tutti i lavori e parli a lui in prima persona («ho sbloccato…», «mi serve un tuo sì su…»). Non leggi le frasi delle sessioni: le riassumi, decidi da solo ciò che puoi e gli porti solo le scelte sue, sempre col nome del lavoro. Dici solo ciò che serve a Roberto, in parole semplici: niente numeri di PR o di issue, sha, percorsi. Le parole tecniche vanno bene, se servono. Se non cambia niente per lui, taci. Una frase è una frase: mai una domanda a cui rispondi tu."

    /// Lines that say nothing about which job or what to do (#299): refused unless the line names the job.
    static let vaguePhrases = ["se funziona", "riprova tra poco", "riprova più tardi", "riprova dopo", "adesso non si può", "adesso non si puo"]

    /// A question the line answers itself («Ti serve dirmi qualcosa adesso? No, era solo un avviso»): never said (#299).
    public static func selfAnswered(_ line: String) -> Bool {
        line.range(of: #"\?\s*[«"]?(sì|si|no)\b"#, options: [.regularExpression, .caseInsensitive]) != nil
            || line.lowercased().contains("ti serve dirmi qualcosa")
    }

    /// A line with one of `vaguePhrases` and no word (4+ letters) of the job's name.
    public static func vague(_ line: String, subject: String) -> Bool {
        let l = line.lowercased()
        guard vaguePhrases.contains(where: l.contains) else { return false }
        return !subject.lowercased().split { !$0.isLetter }.contains { $0.count >= 4 && l.contains($0) }
    }

    /// The language every spoken line is in.
    public static let spokenLanguage = "it"

    /// The ElevenLabs request, the text said as the pronunciation list wants: the key only in the `xi-api-key` header, never in the URL or the body.
    public static func speechRequest(text: String, config: Config, key: String, pronunciation: [String: String]) -> URLRequest {
        var r = URLRequest(url: URL(string: "https://api.elevenlabs.io/v1/text-to-speech/\(config.voiceId)?output_format=mp3_44100_64")!)
        r.httpMethod = "POST"
        r.timeoutInterval = 20
        r.setValue(key, forHTTPHeaderField: "xi-api-key")
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        r.setValue("audio/mpeg", forHTTPHeaderField: "Accept")
        var body: [String: Any] = ["text": pronounced(text, pronunciation), "model_id": config.model, "voice_settings": ["speed": min(config.speed, apiMaxSpeed)]]
        // Without it the model guesses the language and a voice made for another one speaks Italian with its accent (#245).
        if ["turbo", "flash", "v3"].contains(where: config.model.contains) { body["language_code"] = spokenLanguage }
        r.httpBody = try? JSONSerialization.data(withJSONObject: body)
        return r
    }

    /// The player's rate for the speed above what ElevenLabs gives.
    public static func playbackRate(_ config: Config) -> Float { Float(config.speed / min(config.speed, apiMaxSpeed)) }

    /// The «voice said» log line (#271): the seconds that really played, and «interrotta» when `hush()` cut it short.
    public static func saidLog(chars: Int, length: Double, played: Double) -> String {
        let f = { String(format: "%.1f", $0) }
        // 0.5 s: the player is polled every 100 ms, so a voice that ran to its end never falls short by more than that.
        return played < length - 0.5 ? "voice said: \(chars) chars, \(f(played)) s played of \(f(length)) s, interrotta"
                                     : "voice said: \(chars) chars, \(f(length)) s of audio"
    }
}
