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
    private var seen: [String: (at: Date, urgent: Bool)] = [:]  // subject key → when it was last let through

    public init() {}

    /// nil = queued; otherwise why it stays silent.
    public mutating func offer(_ e: VoiceEvent, config: VoiceTurn.Config, sessions: [DesktopSession], now: Date) -> String? {
        if !config.speaks(e, sessions: sessions) { return "fuori da «Parla per»" }
        if now.timeIntervalSince(e.at) > Self.maxAge { return "vecchio" }
        seen = seen.filter { now.timeIntervalSince($0.value.at) < Self.sameSubject }
        let key = Self.key(e)
        // #1854: same subject = one, unless the new one weighs more; a request done and a goal reached of one session = the first.
        if let old = seen[key], !(e.urgent && !old.urgent) { return "doppione" }
        if let pair = Self.closing(e, other: true), seen[pair] != nil { return "doppione" }
        seen[key] = (now, e.urgent)
        if let mine = Self.closing(e, other: false) { seen[mine] = (now, e.urgent) }
        let i = waiting.firstIndex { Self.order(e, before: $0) } ?? waiting.endIndex
        waiting.insert(e, at: i)
        guard waiting.count > Self.maxWaiting else { return nil }
        // The least important one waiting goes; when that is the new one, it is the one refused.
        guard waiting.removeLast() == e else { return nil }
        seen[key] = nil
        if let mine = Self.closing(e, other: false) { seen[mine] = nil }
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

    /// The key of a session's closing news (`other`: of the kind it pairs with); nil for every other event.
    static func closing(_ e: VoiceEvent, other: Bool) -> String? {
        let pair: [VoiceEvent.Kind: VoiceEvent.Kind] = [.requestDone: .goalReached, .goalReached: .requestDone]
        guard !e.session.isEmpty, let k = other ? pair[e.kind] : (pair[e.kind] == nil ? nil : e.kind) else { return nil }
        return "\u{1}\(k.rawValue) \(e.session)"
    }

    /// Same subject in other words (case, spaces, a trailing dot) is the same subject.
    static func key(_ e: VoiceEvent) -> String {
        let s = e.subject.isEmpty ? e.kind.rawValue + " " + e.text : e.subject
        return s.lowercased().split(whereSeparator: \.isWhitespace).joined(separator: " ").trimmingCharacters(in: CharacterSet(charactersIn: ".!?"))
    }
}

extension VoiceTurn.Config {
    /// «Parla per» for one event (#1854): `ruolo` decides «principali» (master or overseer) when the event carries it,
    /// `local_id` decides «una»; otherwise the session files do (#50). No session at all (an account, a rule): it speaks.
    public func speaks(_ e: VoiceEvent, sessions: [DesktopSession]) -> Bool {
        if e.session.isEmpty && e.localId.isEmpty { return true }
        switch audience {
        case .all: return true
        case .main where !e.role.isEmpty: return ["master", "overseer"].contains(e.role)
        case .one where !e.localId.isEmpty: return e.localId == onlySession
        default: return speaks(cliId: e.session, sessions: sessions)
        }
    }
}

/// One «avvisami quando…» rule of `~/.config/voce/avvisi.json`, written by the «Voce» page or by claude-config's
/// `avvisami` (#1854): `{"v": 1, "regole": [{"id": "A-xxxx", "creata", "condizione", "quando": {"tipo", "valore", "repo"} | null,
/// "stato": "attiva" | "scattata"}]}`. One-shot: once it fires it is `scattata` and never fires again.
/// Clotch changes the file's own dictionaries, so a field it does not know stays as it was.
public struct VoiceAlertRule: Equatable, Sendable, Identifiable {
    public enum When: String, Sendable, CaseIterable {
        case prMerged = "pr-fusa", sessionStill = "sessione-ferma", file = "file", time = "ora", word = "testo"
    }

    public let id: String
    public var text: String     // `condizione`
    public var when: When?      // nil = no `quando` (or one Clotch does not know): the Overseer judges it, Clotch never fires it
    public var value: String
    public var repo = ""
    public var created: Date
    public var fired = false    // `stato` "scattata"

    public init(id: String, text: String, when: When?, value: String, repo: String = "", created: Date, fired: Bool = false) {
        self.id = id; self.text = text; self.when = when; self.value = value; self.repo = repo; self.created = created; self.fired = fired
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

    /// The event when the rule fires now (`testo` = the condition, `prova` = what made it fire); nil = not yet, or never.
    public func fires(_ f: Facts) -> VoiceEvent? {
        guard !fired, let when else { return nil }
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
            let r = !repo.isEmpty ? repo : v.contains("/") ? String(v.split(separator: "#").first ?? "") : nil
            hit = n != nil && f.mergedPRs.contains { $0.number == n && (r == nil || $0.repo == r) }
        case .sessionStill:
            hit = f.sessions.contains { s in
                (s.localId == v || s.cliId == v) && !s.isRunning && (s.lastActivity.map { f.now.timeIntervalSince($0) >= Self.stillAfter } ?? true)
            }
        }
        return hit ? VoiceEvent(kind: .custom, at: f.now, subject: text, text: text, proof: "\(when.rawValue) \(v)") : nil
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

    public static func newId() -> String { "A-" + UUID().uuidString.prefix(4).lowercased() }

    public static func parse(_ data: Data?) -> [VoiceAlertRule] {
        (file(data)?.regole ?? []).compactMap { r in
            guard let id = r["id"] as? String, let text = r["condizione"] as? String else { return nil }
            let q = r["quando"] as? [String: Any]
            return VoiceAlertRule(id: id, text: text, when: When(rawValue: q?["tipo"] as? String ?? ""), value: q?["valore"] as? String ?? "",
                                  repo: q?["repo"] as? String ?? "", created: GoalSources.date(r["creata"]) ?? .distantPast,
                                  fired: r["stato"] as? String == "scattata")
        }
    }

    /// The file with one more rule; nil when the file is there but broken (a save never overwrites what must be fixed by hand).
    public static func adding(_ r: VoiceAlertRule, to data: Data?) -> Data? {
        var q: [String: Any] = ["tipo": r.when?.rawValue ?? "", "valore": r.value]
        if !r.repo.isEmpty { q["repo"] = r.repo }
        let row: [String: Any] = ["id": r.id, "creata": r.created.timeIntervalSince1970, "condizione": r.text,
                                  "quando": r.when == nil ? NSNull() : q, "stato": r.fired ? "scattata" : "attiva"]
        return edit(data) { $0 + [row] }
    }

    public static func removing(_ id: String, from data: Data?) -> Data? { edit(data) { $0.filter { $0["id"] as? String != id } } }

    /// The file with these rules `scattata` (+ `scattata` = when, epoch seconds: the engine drops a fired rule 7 days after it); nothing else changes.
    public static func firing(_ ids: Set<String>, in data: Data?, now: Date = Date()) -> Data? {
        edit(data) { $0.map { r in
            var r = r
            if ids.contains(r["id"] as? String ?? "") { r["stato"] = "scattata"; r["scattata"] = Int(now.timeIntervalSince1970) }
            return r
        } }
    }

    /// nil data or an empty file = no rules; anything else that is not a JSON object = broken.
    static func file(_ data: Data?) -> (root: [String: Any], regole: [[String: Any]])? {
        guard let data, !data.isEmpty else { return ([:], []) }
        guard let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return nil }
        return (o, o["regole"] as? [[String: Any]] ?? [])
    }

    static func edit(_ data: Data?, _ change: ([[String: Any]]) -> [[String: Any]]) -> Data? {
        guard let f = file(data) else { return nil }
        var root = f.root
        root["v"] = root["v"] ?? 1
        root["regole"] = change(f.regole)
        return try? JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted, .sortedKeys])
    }
}
