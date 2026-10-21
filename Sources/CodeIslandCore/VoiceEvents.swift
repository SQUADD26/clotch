import Foundation

/// The news the voice may say (#57). Everything else stays silent. One event = one line of
/// `~/.config/voce/eventi.jsonl` (claude-config#1854), or the same thing Clotch derives from what it already reads.
public struct VoiceEvent: Equatable, Sendable {
    public enum Kind: String, Sendable, CaseIterable {
        case requestDone = "richiesta_fatta", goalReached = "obiettivo_raggiunto", goalBlocked = "obiettivo_bloccato"
        case question = "domanda", risk = "rischio", custom = "avviso_custom"

        /// Lower = said first when several wait.
        var rank: Int { [.risk: 0, .question: 1, .goalBlocked: 2, .custom: 3, .requestDone: 4, .goalReached: 5][self]! }

        /// How the report for Haiku names it.
        var label: String {
            switch self {
            case .requestDone: return "Richiesta fatta"
            case .goalReached: return "Obiettivo raggiunto"
            case .goalBlocked: return "Obiettivo bloccato"
            case .question: return "Domanda per te"
            case .risk: return "Rischio"
            case .custom: return "Avviso che hai chiesto"
            }
        }
    }

    public let kind: Kind
    public let at: Date
    public var session = ""   // cli id; "" = not tied to a session (an account, a custom alert): «Parla per» lets it through
    public var subject = ""   // what it is about, in plain words: the key of «no duplicates»
    public var text = ""
    public var proof = ""
    public var level = ""     // `livello`: "alto" / "urgente" goes ahead of its kind

    public init(kind: Kind, at: Date, session: String = "", subject: String = "", text: String = "", proof: String = "", level: String = "") {
        self.kind = kind; self.at = at; self.session = session; self.subject = subject; self.text = text; self.proof = proof; self.level = level
    }

    /// What Haiku turns into one spoken line: cleaned for the ear, cut like a turn's report.
    public var report: String {
        var r = "\(kind.label): \(text.isEmpty ? subject : text)"
        if !proof.isEmpty { r += "\nProva: \(proof)" }
        return VoiceTurn.cut(VoiceClean.clean(String(r.prefix(VoiceTurn.maxRaw))), VoiceTurn.maxSpoken)
    }

    var urgent: Bool { ["alto", "urgente", "alta"].contains(level.lowercased()) }
}

public enum VoiceEvents {
    /// One line of eventi.jsonl: `{t, tipo, sessione: {cli, local_id, titolo}, soggetto, testo, prova, livello}`.
    /// nil for a broken line or a type the voice does not say.
    public static func parse(line: Substring) -> VoiceEvent? {
        guard let o = (try? JSONSerialization.jsonObject(with: Data(line.utf8))) as? [String: Any],
              let kind = VoiceEvent.Kind(rawValue: o["tipo"] as? String ?? "") else { return nil }
        let s = o["sessione"]
        let cli = (s as? [String: Any])?["cli"] as? String ?? s as? String ?? ""
        return VoiceEvent(kind: kind, at: GoalSources.date(o["t"]) ?? Date(), session: cli, subject: o["soggetto"] as? String ?? "",
                          text: o["testo"] as? String ?? "", proof: o["prova"] as? String ?? "", level: o["livello"] as? String ?? "")
    }

    /// The events of the bytes appended since `offset`; a last line without its newline waits for the next read.
    /// Returns the new offset. A file shorter than `offset` was rewritten: read from the start.
    public static func appended(_ data: Data, from offset: Int) -> (events: [VoiceEvent], offset: Int) {
        let start = offset <= data.count ? offset : 0
        guard let end = data[start...].lastIndex(of: UInt8(ascii: "\n")) else { return ([], start) }
        let text = String(decoding: data[start..<end], as: UTF8.self)
        return (text.split(separator: "\n").compactMap(parse(line:)), end + 1)
    }

    // MARK: Derived from what Clotch reads (no eventi.jsonl)

    /// A goal that went raggiunto or bloccato since the last load. `before` nil = the launch baseline: nothing.
    public static func goals(before: [GoalRecord]?, after: [GoalRecord], now: Date) -> [VoiceEvent] {
        guard let before else { return [] }
        let was = Dictionary(before.map { ($0.cli, $0.state) }, uniquingKeysWith: { a, _ in a })
        return after.compactMap { g in
            let kind: VoiceEvent.Kind
            switch g.state {
            case "raggiunto": kind = .goalReached
            case "bloccato": kind = .goalBlocked
            default: return nil
            }
            guard was[g.cli] != g.state else { return nil }
            let title = GoalBoard.clean(g.title)
            let goal = g.goal.split(whereSeparator: \.isWhitespace).joined(separator: " ")
            return VoiceEvent(kind: kind, at: g.at ?? now, session: g.cli, subject: title.isEmpty ? goal : title, text: goal, proof: g.proof)
        }
    }

    /// A request of Roberto's that went fatta since the last load (`before` nil = baseline).
    public static func requests(before: [UserRequest]?, after: [UserRequest], now: Date) -> [VoiceEvent] {
        guard let before else { return [] }
        let was = Dictionary(before.map { ($0.id, $0.state) }, uniquingKeysWith: { a, _ in a })
        return after.filter { $0.state == "fatta" && was[$0.id] != "fatta" && !$0.notOurs }.map {
            VoiceEvent(kind: .requestDone, at: $0.doneAt ?? now, session: $0.session, subject: $0.text, text: $0.text, proof: $0.proof)
        }
    }

    public static let riskThresholds: [Double] = [80, 90]

    /// An account window that crossed 80 % or 90 % since the last reading (`before` nil = baseline).
    public static func quotas(before: [AccountQuota]?, after: [AccountQuota], now: Date) -> [VoiceEvent] {
        guard let before else { return [] }
        let was = Dictionary(before.map { ($0.email, $0) }, uniquingKeysWith: { a, _ in a })
        var out: [VoiceEvent] = []
        for a in after where !a.stale(now) {
            for (name, w, old) in [("5 ore", a.fiveHour, was[a.email]?.fiveHour), ("7 giorni", a.sevenDay, was[a.email]?.sevenDay)] {
                guard let used = w.usedNow(now) else { continue }
                let prior = old?.usedNow(now) ?? 0
                guard let crossed = riskThresholds.last(where: { prior < $0 && used >= $0 }) else { continue }
                out.append(VoiceEvent(kind: .risk, at: now, subject: "Account \(a.label), \(name)",
                                      text: "L'account \(a.label) ha usato il \(Int(used)) per cento delle \(name)",
                                      level: crossed >= 90 ? "alto" : ""))
            }
        }
        return out
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
