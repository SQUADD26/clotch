import Foundation

/// The alerts engine (#57): which events the voice says, and in what order. Pure: the caller passes `now`.
/// Rules: «Parla per», one per subject in 10 minutes, one voice at a time with a short queue (risks and
/// questions first), a stale event never said. The daily caps stay in `VoiceTurn.refusal`, at speaking time.
public struct VoiceAlertEngine {
    public static let sameSubject: TimeInterval = 600
    public static let maxWaiting = 3
    /// An event still waiting after this is old news: dropped.
    public static let maxAge: TimeInterval = 300

    public private(set) var waiting: [VoiceEvent] = []
    private var seen: [String: Date] = [:]  // subject key → when it was last let through

    public init() {}

    /// nil = queued; otherwise why it stays silent.
    public mutating func offer(_ e: VoiceEvent, config: VoiceTurn.Config, sessions: [DesktopSession], now: Date) -> String? {
        if !e.session.isEmpty, !config.speaks(cliId: e.session, sessions: sessions) { return "fuori da «Parla per»" }
        if now.timeIntervalSince(e.at) > Self.maxAge { return "vecchio" }
        let key = Self.key(e)
        if let t = seen[key], now.timeIntervalSince(t) < Self.sameSubject { return "doppione" }
        seen = seen.filter { now.timeIntervalSince($0.value) < Self.sameSubject }
        seen[key] = now
        let i = waiting.firstIndex { Self.order(e, before: $0) } ?? waiting.endIndex
        waiting.insert(e, at: i)
        guard waiting.count > Self.maxWaiting else { return nil }
        // The least important one waiting goes; when that is the new one, it is the one refused.
        guard waiting.removeLast() == e else { return nil }
        seen[key] = nil
        return "coda piena"
    }

    /// The next event to say; drops the ones that got old while the voice spoke.
    public mutating func next(now: Date) -> VoiceEvent? {
        waiting.removeAll { now.timeIntervalSince($0.at) > Self.maxAge }
        return waiting.isEmpty ? nil : waiting.removeFirst()
    }

    static func order(_ a: VoiceEvent, before b: VoiceEvent) -> Bool {
        if a.urgent != b.urgent { return a.urgent }
        return a.kind.rank < b.kind.rank
    }

    /// Same subject in other words (case, spaces, a trailing dot) is the same subject.
    static func key(_ e: VoiceEvent) -> String {
        let s = e.subject.isEmpty ? e.kind.rawValue + " " + e.text : e.subject
        return s.lowercased().split(whereSeparator: \.isWhitespace).joined(separator: " ").trimmingCharacters(in: CharacterSet(charactersIn: ".!?"))
    }
}

/// One «avvisami quando…» rule of `~/.config/voce/avvisi.json`, written by the «Voce» page or by claude-config's
/// `avvisami` (#1854): `{"avvisi": [{"id", "testo", "quando", "valore", "t", "scattato"}]}`. One-shot: once it
/// fires, `scattato` holds when, and it never fires again.
public struct VoiceAlertRule: Equatable, Sendable, Identifiable {
    public enum When: String, Sendable, CaseIterable {
        case prMerged = "pr-fusa", sessionStill = "sessione-ferma", file = "file", time = "ora", word = "testo"
    }

    public let id: String
    public var text: String
    public var when: When
    public var value: String
    public var created: Date
    public var fired: Date? = nil

    public init(id: String, text: String, when: When, value: String, created: Date, fired: Date? = nil) {
        self.id = id; self.text = text; self.when = when; self.value = value; self.created = created; self.fired = fired
    }

    /// What Clotch knows when it checks the rules. A field the check does not need stays empty.
    public struct Facts {
        public var now: Date
        public var answer = ""                       // the text of a turn that just ended
        public var mergedPRs: [PRRef] = []           // merges just seen
        public var sessions: [DesktopSession] = []
        public var fileExists: (String) -> Bool = { FileManager.default.fileExists(atPath: ($0 as NSString).expandingTildeInPath) }
        public init(now: Date) { self.now = now }
    }

    public static let stillAfter: TimeInterval = 600

    /// The event when the rule fires now; nil = not yet (or already fired).
    public func fires(_ f: Facts) -> VoiceEvent? {
        guard fired == nil else { return nil }
        let v = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let hit: Bool
        switch when {
        case .time:
            hit = Self.today(v, after: created).map { f.now >= $0 } ?? false
        case .word:
            hit = !v.isEmpty && f.answer.range(of: v, options: [.caseInsensitive, .diacriticInsensitive]) != nil
        case .file:
            hit = !v.isEmpty && f.fileExists(v)
        case .prMerged:
            let n = Int(v.split(separator: "#").last.map(String.init) ?? v)
            let repo = v.contains("/") ? String(v.split(separator: "#").first ?? "") : nil
            hit = n != nil && f.mergedPRs.contains { $0.number == n && (repo == nil || $0.repo == repo) }
        case .sessionStill:
            hit = f.sessions.contains { s in
                (s.localId == v || s.cliId == v) && !s.isRunning && (s.lastActivity.map { f.now.timeIntervalSince($0) >= Self.stillAfter } ?? true)
            }
        }
        return hit ? VoiceEvent(kind: .custom, at: f.now, subject: text, text: text) : nil
    }

    /// «HH:MM» as the first such moment after the rule was written (a time already past today means tomorrow).
    static func today(_ hhmm: String, after created: Date) -> Date? {
        let p = hhmm.split(separator: ":").compactMap { Int($0) }
        guard p.count == 2, (0..<24).contains(p[0]), (0..<60).contains(p[1]) else { return nil }
        let cal = Calendar.current
        guard let d = cal.date(bySettingHour: p[0], minute: p[1], second: 0, of: created) else { return nil }
        return d > created ? d : cal.date(byAdding: .day, value: 1, to: d)
    }

    // MARK: File

    public static func parse(_ data: Data?) -> [VoiceAlertRule] {
        guard let data, let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return [] }
        return (o["avvisi"] as? [Any] ?? []).compactMap { item in
            guard let r = item as? [String: Any], let id = r["id"] as? String, let text = r["testo"] as? String,
                  let when = When(rawValue: r["quando"] as? String ?? "") else { return nil }
            return VoiceAlertRule(id: id, text: text, when: when, value: r["valore"] as? String ?? "",
                                  created: GoalSources.date(r["t"]) ?? .distantPast, fired: GoalSources.date(r["scattato"]))
        }
    }

    public static func encode(_ rules: [VoiceAlertRule]) -> Data {
        let iso = ISO8601DateFormatter()
        let list: [[String: Any]] = rules.map { r in
            ["id": r.id, "testo": r.text, "quando": r.when.rawValue, "valore": r.value, "t": iso.string(from: r.created),
             "scattato": r.fired.map { iso.string(from: $0) } ?? NSNull()]
        }
        return (try? JSONSerialization.data(withJSONObject: ["avvisi": list], options: [.prettyPrinted, .sortedKeys])) ?? Data()
    }
}
