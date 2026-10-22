import Foundation

/// AFK mode (#106; engine claude-config#1915, contract «Modalità AFK» in claude-config `global/skills/overseer/eventi.md`).
/// `voce afk on|off` is the only writer: `afk.json` says whether Roberto is away (Clotch's voice stays silent), the engine
/// appends what got done to `afk-fatto.jsonl`, and `off` writes `afk-riepilogo.json`, which the notch shows on his return.
/// Clotch only reads them. `CLOTCH_DIR` moves `~/.config/clotch` (tests).
public struct AfkFiles {
    public let stateURL, doneURL, summaryURL: URL

    public init(home: URL = FileManager.default.homeDirectoryForCurrentUser,
                env: [String: String] = ProcessInfo.processInfo.environment) {
        stateURL = home.appendingPathComponent(".config/voce/afk.json")
        let clotch = env["CLOTCH_DIR"].map { URL(fileURLWithPath: $0, isDirectory: true) }
            ?? home.appendingPathComponent(".config/clotch")
        doneURL = clotch.appendingPathComponent("afk-fatto.jsonl")
        summaryURL = clotch.appendingPathComponent("afk-riepilogo.json")
    }

    public var state: AfkState? { (try? Data(contentsOf: stateURL)).flatMap { try? JSONDecoder().decode(AfkState.self, from: $0) } }
    public var isOn: Bool { state?.attivo == true }
    public var summary: AfkSummary? { (try? Data(contentsOf: summaryURL)).flatMap { try? JSONDecoder().decode(AfkSummary.self, from: $0) } }

    /// The things done from `since` to `until`; a line that is not one is skipped, never fatal. The lines that are
    /// for Roberto to look at (`AfkWatch.kinds`, claude-config#2038) are not things done: the summary's `da_guardare` carries them.
    public func items(since: Double, until: Double = .infinity) -> [AfkItem] {
        let text = (try? String(contentsOf: doneURL, encoding: .utf8)) ?? ""
        return text.split(separator: "\n").compactMap { try? JSONDecoder().decode(AfkItem.self, from: Data($0.utf8)) }
            .filter { $0.t >= since && $0.t <= until && !AfkWatch.kinds.contains($0.tipo) }
    }

    /// What the notch shows on return: the summary and the list of its absence.
    public var report: AfkReport? {
        summary.map { AfkReport(summary: $0, items: items(since: $0.inizio, until: $0.t)) }
    }
}

/// `afk.json`: `{"v":1,"attivo":bool,"inizio":t,"fine":t|null}`, seconds since 1970.
public struct AfkState: Decodable, Equatable {
    public let attivo: Bool
    public let inizio: Double
    public let fine: Double?
}

/// One entry of `da_guardare` (claude-config#2038): what Roberto must look at, not something done.
public struct AfkWatch: Decodable, Equatable, Identifiable {
    public let tipo, testo: String
    public var id: String { "\(tipo)|\(testo)" }

    /// The engine's four kinds; any other word is not shown (the engine adds a kind, the Figma adds its label).
    public static let kinds: Set<String> = ["rischio", "aspetta_ok", "dipendenza_ferma", "risposta_adhd"]

    public init(tipo: String, testo: String) { self.tipo = tipo; self.testo = testo }

    /// The state label of Figma «Da guardare» (66-60766).
    public var label: String {
        switch tipo {
        case "rischio": return "Limite vicino"
        case "aspetta_ok": return "Aspetta te"
        case "dipendenza_ferma": return "Lavoro fermo"
        default: return "Risposta arrivata"
        }
    }

    /// Orange like «Obiettivo bloccato» for the three that wait on Roberto or a limit; grey for an answer that came.
    public var isAnswer: Bool { tipo == "risposta_adhd" }
}

/// `afk-riepilogo.json`: `t` = when AFK ended, `frase` = what the voice says (at most 4 sentences), `da_guardare` = what to look at.
public struct AfkSummary: Decodable, Equatable {
    public let t: Double
    public let inizio: Double
    public let n: Int
    public let frase: String
    public let watch: [AfkWatch]

    public init(t: Double, inizio: Double, n: Int, frase: String, watch: [AfkWatch] = []) {
        self.t = t; self.inizio = inizio; self.n = n; self.frase = frase; self.watch = watch
    }

    private enum CodingKeys: String, CodingKey { case t, inizio, n, frase, da_guardare }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // A file from before #2038 has no `da_guardare`; a broken or unknown entry is skipped, never fatal.
        let entries = ((try? c.decodeIfPresent([Lenient<AfkWatch>].self, forKey: .da_guardare)) ?? nil) ?? []
        self.init(t: try c.decode(Double.self, forKey: .t), inizio: try c.decode(Double.self, forKey: .inizio),
                  n: try c.decode(Int.self, forKey: .n), frase: try c.decode(String.self, forKey: .frase),
                  watch: entries.compactMap(\.value).filter { AfkWatch.kinds.contains($0.tipo) })
    }

    private struct Lenient<T: Decodable>: Decodable {
        let value: T?
        init(from decoder: Decoder) throws { value = try? T(from: decoder) }
    }

    public static let nothing = "Mentre eri via non è successo niente di importante."

    /// Shown once, on return: newer than the last one shown and less than an hour old (the engine's own rule for the voice).
    public func isNew(seen: Double, now: Date) -> Bool { t > seen && now.timeIntervalSince1970 - t < 3600 }
}

/// One line of `afk-fatto.jsonl`. Missing text fields read as empty.
public struct AfkItem: Decodable, Equatable, Identifiable {
    public let t: Double
    public let tipo, sessione, localId, titolo, testo, link, prova: String
    public var id: String { "\(t)|\(tipo)|\(testo)" }

    public init(t: Double, tipo: String, sessione: String = "", localId: String = "", titolo: String, testo: String,
                link: String = "", prova: String = "") {
        self.t = t; self.tipo = tipo; self.sessione = sessione; self.localId = localId
        self.titolo = titolo; self.testo = testo; self.link = link; self.prova = prova
    }

    private enum CodingKeys: String, CodingKey { case t, tipo, sessione, local_id, titolo, testo, link, prova }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func s(_ k: CodingKeys) -> String { ((try? c.decodeIfPresent(String.self, forKey: k)) ?? nil) ?? "" }
        self.init(t: try c.decode(Double.self, forKey: .t), tipo: s(.tipo), sessione: s(.sessione), localId: s(.local_id),
                  titolo: s(.titolo), testo: s(.testo), link: s(.link), prova: s(.prova))
    }

    /// The kind, as the list says it.
    public var kind: String {
        switch tipo {
        case "richiesta_fatta": return "Richiesta fatta"
        case "obiettivo_raggiunto": return "Obiettivo raggiunto"
        case "obiettivo_bloccato": return "Obiettivo bloccato"
        case "fine_turno": return "Fine turno"
        case "pr_unita": return "PR unita"
        default: return tipo
        }
    }

    /// «PR #105» for a pull request link; nil otherwise (the list links PRs only).
    public var linkLabel: String? {
        guard let url = URL(string: link), url.pathComponents.dropLast().last == "pull", let n = Int(url.lastPathComponent) else { return nil }
        return "PR #\(n)"
    }
}

/// The work one group of the list is about: its things in time order, and the session that did them.
public struct AfkGroup: Equatable, Identifiable {
    public let title: String
    public let items: [AfkItem]
    public var id: String { title }
    /// The first session title and local id the group's lines carry (a merged PR carries none).
    public var session: String { items.first { !$0.sessione.isEmpty }?.sessione ?? "" }
    public var localId: String { items.first { !$0.localId.isEmpty }?.localId ?? "" }

    /// «⌘ Clotch: avviso» → the chip «⌘», «Clotch»; nil when the title has no «Area:».
    public var chip: (icon: String, area: String)? {
        let name = Self.withoutIcon(session)
        guard let colon = name.firstIndex(of: ":") else { return nil }
        return (icon, String(name[..<colon]).trimmingCharacters(in: .whitespaces))
    }

    /// «Clotch: avviso di aggiornamento · 2 cose».
    public var subtitle: String {
        let name = Self.withoutIcon(session)
        return name.isEmpty ? AfkReport.count(items.count) : "\(name) · \(AfkReport.count(items.count))"
    }

    private var icon: String {
        let first = session.split(separator: " ", maxSplits: 1).first.map(String.init) ?? ""
        return first.contains(where: { $0.isLetter || $0.isNumber }) ? "" : first
    }

    private static func withoutIcon(_ s: String) -> String {
        let parts = s.split(separator: " ", maxSplits: 1)
        guard let first = parts.first, !first.contains(where: { $0.isLetter || $0.isNumber }) else { return s }
        return parts.count > 1 ? String(parts[1]) : ""
    }

    /// Grouped by work title (the session's when it has none), the most recent work first, each in time order.
    public static func groups(_ items: [AfkItem]) -> [AfkGroup] {
        Dictionary(grouping: items) { $0.titolo.isEmpty ? $0.sessione : $0.titolo }
            .map { AfkGroup(title: $0.key, items: $0.value.sorted { $0.t < $1.t }) }
            .sorted { ($0.items.last?.t ?? 0) > ($1.items.last?.t ?? 0) }
    }
}

/// The return screen: the sentence, the groups, how many things and how long Roberto was away.
public struct AfkReport: Equatable {
    public let summary: AfkSummary
    public let groups: [AfkGroup]
    public let count: Int
    public var watch: [AfkWatch] { summary.watch }

    public init(summary: AfkSummary, items: [AfkItem]) {
        self.summary = summary
        groups = AfkGroup.groups(items)
        count = items.isEmpty ? summary.n : items.count
    }

    /// The sentence without its tail «Da guardare: N, …» (the block under it says that, #185).
    public var sentence: String {
        var s = summary.frase.trimmingCharacters(in: .whitespacesAndNewlines)
        if let tail = s.range(of: "Da guardare: ", options: .backwards), s[tail.upperBound...].first?.isNumber == true {
            s = String(s[..<tail.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return s.isEmpty ? AfkSummary.nothing : s
    }

    /// Nothing done but something to look at: only the block, no «non è successo niente» (#185).
    public var showsSentence: Bool { count > 0 || watch.isEmpty }

    /// «5 cose · via per 1 h 42 min»; with nothing done, only how long.
    public var heading: String {
        let away = "via per " + Self.duration(summary.t - summary.inizio)
        return count == 0 ? away : "\(Self.count(count)) · \(away)"
    }

    public static func count(_ n: Int) -> String { n == 1 ? "1 cosa" : "\(n) cose" }

    static func duration(_ seconds: Double) -> String {
        let m = max(1, Int(seconds / 60))
        return m < 60 ? "\(m) min" : m % 60 == 0 ? "\(m / 60) h" : "\(m / 60) h \(m % 60) min"
    }
}

/// «Spegni AFK quando torni al Mac»: back = input again after at least `away` seconds without any.
public struct AfkPresence {
    public static let away: TimeInterval = 120
    private var wasAway = false

    public init() {}

    /// Fed with the seconds since the last input; true once, when Roberto is back.
    public mutating func back(idle: TimeInterval) -> Bool {
        if idle >= Self.away { wasAway = true; return false }
        guard wasAway, idle < 5 else { return false }
        wasAway = false
        return true
    }
}
