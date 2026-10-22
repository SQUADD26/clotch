import Foundation

/// The news the voice may say (#57). Everything else stays silent. One event = one line of
/// `~/.config/voce/eventi.jsonl` (claude-config#1854). The engine is the only producer of facts (#202): Clotch only says them.
public struct VoiceEvent: Equatable, Sendable {
    public enum Kind: String, Sendable, CaseIterable {
        case requestDone = "richiesta_fatta", goalReached = "obiettivo_raggiunto", goalBlocked = "obiettivo_bloccato"
        case question = "domanda", risk = "rischio", custom = "avviso_custom", endOfTurn = "fine_turno"
        case adhdAnswer = "risposta_adhd"  // the answer to a question Roberto chased in the ADHD tab (claude-config#1945)
        case stalledDependency = "dipendenza_ferma"  // a session has waited on Roberto past the threshold (dipendenze.py)
        case waitsForOk = "aspetta_ok"  // a session waits for Roberto's written ok (dipendenze.py, #1982): said like a question

        /// Lower = said first when several wait.
        var rank: Int { [.risk: 0, .question: 1, .waitsForOk: 1, .adhdAnswer: 1, .stalledDependency: 2, .goalBlocked: 2, .custom: 3, .requestDone: 4, .goalReached: 5, .endOfTurn: 6][self]! }

        /// How the report for Haiku names it.
        var label: String {
            switch self {
            case .requestDone: return "Richiesta fatta"
            case .goalReached: return "Obiettivo raggiunto"
            case .goalBlocked: return "Obiettivo bloccato"
            case .question: return "Domanda per te"
            case .risk: return "Rischio"
            case .custom: return "Avviso che hai chiesto"
            case .endOfTurn: return "Novità"
            case .adhdAnswer: return "Risposta alla tua domanda"
            case .stalledDependency: return "Una sessione aspetta te"
            case .waitsForOk: return "Aspetta il tuo ok"
            }
        }
    }

    public let kind: Kind
    public let at: Date
    public var id = ""        // "e-xxxxxxxx" in eventi.jsonl; "" for a derived event
    public var session = ""   // cli id; "" = not tied to a session (an account, a custom alert): «Parla per» lets it through
    public var localId = ""   // `local_…` of the Claude app
    public var role = ""      // master | figlia | overseer | "" (unknown: «Parla per» uses the session file)
    public var subject = ""   // what it is about, in plain words: the key of «no duplicates»
    public var text = ""
    public var proof = ""     // for the eye: never said out loud
    public var level = "normale"  // alto | normale
    public var judged = false  // `giudizio` already written by claude-config (or by Clotch's judge): not judged again

    public init(kind: Kind, at: Date, session: String = "", subject: String = "", text: String = "", proof: String = "", level: String? = nil) {
        self.kind = kind; self.at = at; self.session = session; self.subject = subject; self.text = text; self.proof = proof
        self.level = level ?? kind.level
    }

    /// What Haiku turns into one spoken line: cleaned for the ear, cut like a turn's report. The proof stays out (#1854).
    public var report: String {
        let body = text.isEmpty ? subject : text
        // The engine already writes «Obiettivo raggiunto:» in front of its text (obiettivo_registro.py): the prefix is said once (#204).
        let said = body.range(of: kind.label + ":", options: [.anchored, .caseInsensitive]) != nil ? body : "\(kind.label): \(body)"
        return VoiceTurn.cut(VoiceClean.clean(String(said.prefix(VoiceTurn.maxRaw))), VoiceTurn.maxSpoken)
    }

    /// The job, for the parlatore's `<contesto>` (#204): the subject, which `report` only carries when there is no text.
    public var context: String { text.isEmpty ? "" : VoiceClean.clean(String(subject.prefix(200))) }

    var urgent: Bool { level == "alto" }
}

extension VoiceEvent.Kind {
    /// The `livello` claude-config gives each type (#1854).
    var level: String { [.goalBlocked, .question, .risk, .adhdAnswer, .stalledDependency, .waitsForOk].contains(self) ? "alto" : "normale" }
}

public enum VoiceEvents {
    /// One line of eventi.jsonl (contract: claude-config `global/skills/overseer/eventi.md`, v 1):
    /// `{v, id, t, tipo, livello, sessione: {cli, local_id, titolo, ruolo}, soggetto, testo, prova, giudizio?}`.
    /// nil for a broken line or a type the voice does not say.
    public static func parse(line: Substring) -> VoiceEvent? {
        guard let o = (try? JSONSerialization.jsonObject(with: Data(line.utf8))) as? [String: Any],
              let kind = VoiceEvent.Kind(rawValue: o["tipo"] as? String ?? ""), let at = GoalSources.date(o["t"]) else { return nil }
        let s = o["sessione"] as? [String: Any] ?? [:]
        var e = VoiceEvent(kind: kind, at: at, session: s["cli"] as? String ?? "", subject: o["soggetto"] as? String ?? "",
                           text: o["testo"] as? String ?? "", proof: o["prova"] as? String ?? "", level: o["livello"] as? String)
        e.id = o["id"] as? String ?? ""
        e.localId = s["local_id"] as? String ?? ""
        e.role = s["ruolo"] as? String ?? ""
        e.judged = o["giudizio"] != nil
        return e
    }

    /// Where the reader stopped: the `t` and `id` of the last event seen, never a byte offset (the file is rewritten
    /// with its last 200 lines past 512 KB).
    public struct Mark: Equatable, Sendable { public var at: Date; public var id: String }

    /// The events after `mark`, the new mark, and the `tipo` of each new line the voice does not know (for the log: never
    /// dropped in silence, #163). A last line without its newline waits for the next read.
    /// `mark` nil = the launch: nothing is old news to say, only the mark is taken.
    public static func newer(_ data: Data, after mark: Mark?) -> (events: [VoiceEvent], mark: Mark?, unknown: [String]) {
        var text = String(decoding: data, as: UTF8.self)
        if !text.hasSuffix("\n") { text = String(text[..<(text.lastIndex(of: "\n").map { text.index(after: $0) } ?? text.startIndex)]) }
        let all = text.split(separator: "\n").compactMap(entry(line:))
        let last = all.last.map { Mark(at: $0.at, id: $0.id) } ?? mark
        guard let mark else { return ([], last, []) }
        // The mark's line still there: what follows it. Gone (rewritten): what is newer than it.
        let new = !mark.id.isEmpty ? all.lastIndex(where: { $0.id == mark.id }).map { Array(all[($0 + 1)...]) } : nil
        let fresh = new ?? all.filter { $0.at > mark.at }
        return (fresh.compactMap(\.event), last, fresh.filter { $0.event == nil && !ScreenNotice.types.contains($0.type) }.map(\.type))
    }

    /// Any well-formed line, known type or not: the mark moves past a type the voice does not say.
    private static func entry(line: Substring) -> (at: Date, id: String, type: String, event: VoiceEvent?)? {
        guard let o = (try? JSONSerialization.jsonObject(with: Data(line.utf8))) as? [String: Any], let at = GoalSources.date(o["t"]) else { return nil }
        return (at, o["id"] as? String ?? "", o["tipo"] as? String ?? "", parse(line: line))
    }

    /// An end of turn (the Stop payload Clotch's hook queued): its session, the answer's text, and the question in it.
    /// nil = Stop fired again by a blocking stop hook, or not a payload.
    public static func stop(payload: Data, transcriptTail: (String) -> Data?, now: Date) -> (session: String, answer: String, question: VoiceEvent?)? {
        guard let o = (try? JSONSerialization.jsonObject(with: payload)) as? [String: Any], o["stop_hook_active"] as? Bool != true else { return nil }
        let session = o["session_id"] as? String ?? ""
        let tail = (o["transcript_path"] as? String).flatMap(transcriptTail)
        var answer = o["last_assistant_message"] as? String ?? ""
        if answer.isEmpty, let tail { answer = VoiceTurn.lastAssistantText(tail) ?? "" }
        return (session, answer, question(session: session, answer: answer, transcriptTail: tail, now: now))
    }

    /// The question only Roberto can answer at the end of a turn: the questions of the last `giro_finito` /
    /// `needs_you` call in the transcript tail; without them, an answer that ends with «?».
    public static func question(session: String, answer: String, transcriptTail: Data?, now: Date) -> VoiceEvent? {
        let asked = transcriptTail.flatMap(declaredQuestions) ?? (answer.trimmingCharacters(in: .whitespacesAndNewlines).hasSuffix("?") ? [lastSentence(answer)] : [])
        guard !asked.isEmpty else { return nil }
        let text = asked.joined(separator: " ")
        return VoiceEvent(kind: .question, at: now, session: session, subject: text, text: text)
    }

    /// nil = no declaration in the tail; [] = a declaration with no question (the turn needs nothing from Roberto).
    static func declaredQuestions(_ tail: Data) -> [String]? {
        for line in String(decoding: tail, as: UTF8.self).split(separator: "\n").reversed() {
            guard line.contains("giro_finito") || line.contains("needs_you"),
                  let o = (try? JSONSerialization.jsonObject(with: Data(line.utf8))) as? [String: Any],
                  let content = (o["message"] as? [String: Any])?["content"] as? [[String: Any]] else { continue }
            for c in content.reversed() where c["type"] as? String == "tool_use" {
                let name = c["name"] as? String ?? ""
                guard name.hasSuffix("giro_finito") || name.hasSuffix("needs_you") else { continue }
                let input = c["input"] as? [String: Any] ?? [:]
                return ((input["domande"] ?? input["questions"]) as? [Any] ?? []).compactMap { $0 as? String }
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
            }
        }
        return nil
    }

    static func lastSentence(_ t: String) -> String {
        let s = t.trimmingCharacters(in: .whitespacesAndNewlines)
        let body = s.dropLast()
        let cut = body.lastIndex { ".!?\n".contains($0) }.map { body.index(after: $0) } ?? s.startIndex
        return String(s[cut...]).trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
