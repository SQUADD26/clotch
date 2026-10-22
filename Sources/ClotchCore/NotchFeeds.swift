import Foundation

// Roberto's requests for the notch. Same rules as GoalSources: read-only,
// a missing or broken file is "no data", never an error. The API is never called.

/// One ~/.claude/richieste/<id>.json, as claude-config richieste.py writes it (#1720). Times are epoch seconds or ISO.
public struct UserRequest: Identifiable, Equatable, Sendable {
    public let id: String             // "Q-xxxxxxxx"
    public let at: Date?
    public let session: String        // cli id
    public let sessionTitle: String   // as written, icons included, like goal titles
    public let text: String           // short, imperative
    public let original: String       // Roberto's words, verbatim
    public let state: String          // nuova|presa|ferma|fatta (the engine's word, never re-derived here)
    public let takenAt: Date?
    public let takenBy: String
    public let doneAt: Date?
    public let proof: String          // #PR / sha, or the reason it was closed
    public let notOurs: Bool
    public let folder: String
    public let kind: String           // compito|domanda (nota never gets here); no `tipo` = compito
    public let answer: String         // `risposta`: the direct answer, one sentence; "" while there is none (#90)
    public let answeredAt: Date?      // `t_risposta`
    public let localId: String        // app id (`local_…`) of the session that took it; "" while the register does not know it
    /// `testo_da` "ripiego" (claude-config#2045): `text` is still Roberto's own words, not a title. Never listed nor announced:
    /// `GoalLoader` drops it until the engine writes the real title.
    public var titleReady = true
    /// The engine's line under the title (`punto`, claude-config#2020: for «ferma» its reason); the answer for files without it.
    public var point = ""
    /// `esce_t`: a done request leaves the list at this time, none = at once. `aspetta_te`: a taken one the session wants Roberto for.
    public var leavesAt: Date? = nil
    public var waitsForYou = false
    /// The session that took it in charge, set by `GoalLoader` from `localId`, else from `takenBy` (its title, or a cli id in old files); nil when not taken or unknown.
    public var target: SessionTarget? = nil

    /// Struck through in the view once a session has taken it in charge.
    public var taken: Bool { state == "presa" || state == "fatta" }

    /// How a request looks, the one place that decides it (#39, #67): taken = yellow «In lavorazione», never struck
    /// nor green; struck, ticked and green only once done. Every view reads label, struck and ink from here.
    public enum Look: Equatable, Sendable {
        case waiting, working, stuck, done
        public enum Ink: Equatable, Sendable { case quiet, wait, stop, go }
        public var label: String { switch self { case .waiting: "In attesa"; case .working: "In lavorazione"; case .stuck: "Ferma"; case .done: "Fatta" } }
        public var struck: Bool { self == .done }
        public var ink: Ink { switch self { case .waiting: .quiet; case .working: .wait; case .stuck: .stop; case .done: .go } }
    }

    public var look: Look { state == "fatta" ? .done : state == "presa" ? .working : state == "ferma" ? .stuck : .waiting }

    public var isQuestion: Bool { kind == "domanda" }
    public var answered: Bool { !answer.isEmpty }

    /// Label under the look: a question never «takes charge», it waits for its answer (#90).
    public var statusLabel: String {
        look == .stuck ? look.label : waitsForYou ? "In attesa di te" : isQuestion ? (answered ? "Risposta" : "In attesa di risposta") : look.label
    }

    /// What waits for Roberto, the one count of the zone and of the tab header (#209): a new task, or a taken one while its
    /// session wants him (`aspetta_te`). Not «ferma», not a question, not a plain taken one.
    public static func waiting(_ all: [UserRequest]) -> [UserRequest] {
        all.filter { !$0.isQuestion && ($0.state == "nuova" || ($0.state == "presa" && $0.waitsForYou)) }
    }

    /// What the Requests tab lists (#199): the requests the engine leaves open, in its own words. «ferma» is listed, with its
    /// reason; every taken one (#261: `presa_da` is its taker's title, `point` its point); a done one a few minutes (`newsWindow`) after
    /// `t_fatta`, never past `esce_t` (the engine's own 24 h), none = out at once.
    public static func listed(_ all: [UserRequest], now: Date) -> [UserRequest] {
        let live = all.filter { r in
            r.state != "fatta" || min(r.leavesAt ?? .distantPast, (r.doneAt ?? .distantFuture).addingTimeInterval(newsWindow)) > now
        }
        return live.filter { $0.state != "fatta" } + live.filter { $0.state == "fatta" }  // open first, the done ones after
    }

    /// An answer written after Roberto last opened the tab (#90).
    public func isNewAnswer(since seen: Date) -> Bool { answered && (answeredAt ?? .distantPast) > seen }

    /// A fact older than this is not news (#173): a record rewritten later (migration, new fields, a read caught
    /// mid-write, a restart) never announces it again. No time on the record = cannot tell, so it counts as new.
    public static let newsWindow: TimeInterval = 300
    public static func isNews(_ fact: Date?, now: Date) -> Bool { fact.map { now.timeIntervalSince($0) <= newsWindow } ?? true }

    /// Ids to play the «presa in carico» animation for: taken now, seen as nuova (or not seen at all) on the
    /// previous load, not shown yet, taken within `newsWindow`. The first load (`before` nil) is the baseline.
    public static func newlyTaken(before: [UserRequest]?, after: [UserRequest], shown: Set<String>, now: Date) -> [String] {
        guard let before else { return [] }
        let was = Dictionary(before.map { ($0.id, $0.taken) }, uniquingKeysWith: { a, _ in a })
        return after.filter { !$0.isQuestion && $0.taken && was[$0.id] != true && !shown.contains($0.id)
            && isNews($0.takenAt ?? $0.doneAt, now: now) }.map(\.id)
    }
}

extension GoalSources {
    /// A note (`tipo` "nota", claude-config#1825) never shows. A question (`tipo` "domanda") does since #90, but is never
    /// «taken in charge» (`isQuestion`). No `tipo` = a task. The one place that reads the file.
    public static func parseRequest(_ data: Data) -> UserRequest? {
        guard let d = object(data), let id = d["id"] as? String, !id.isEmpty,
              let text = d["testo"] as? String,
              d["tipo"] as? String != "nota" else { return nil }
        var r = UserRequest(id: id, at: date(d["t"]), session: d["sessione"] as? String ?? "",
                           sessionTitle: GoalBoard.clean(d["titolo_sessione"] as? String ?? ""),
                           text: firstSentence(of: headline(text) ?? headline(d["originale"] as? String ?? "", firstLine: true) ?? "una richiesta",
                                               whenRaw: d["originale"] as? String == text),
                           original: d["originale"] as? String ?? text,
                           state: d["stato"] as? String ?? "nuova", takenAt: date(d["t_presa"]),
                           takenBy: d["presa_da"] as? String ?? "", doneAt: date(d["t_fatta"]),
                           proof: d["prova"] as? String ?? "", notOurs: d["non_nostra"] as? Bool ?? false,
                           folder: d["cartella"] as? String ?? "", kind: d["tipo"] as? String ?? "compito",
                           answer: (d["risposta"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines),
                           answeredAt: date(d["t_risposta"]), localId: d["local_id"] as? String ?? "")
        r.titleReady = d["testo_da"] as? String != "ripiego"
        r.point = (d["punto"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? r.answer
        r.leavesAt = date(d["esce_t"]); r.waitsForYou = d["aspetta_te"] as? Bool ?? false
        return r
    }

    /// A file the engine never shortened (`testo` == `originale`) and that is long: its first sentence, whole, never
    /// cut with «…» (#156). shortcut: no sentence end found = the whole text, the engine always writes `testo` short.
    static func firstSentence(of s: String, whenRaw raw: Bool) -> String {
        guard raw, s.count > 140, let end = s.range(of: #"[.?!](\s|$)"#, options: .regularExpression) else { return s }
        return String(s[..<end.upperBound]).trimmingCharacters(in: .whitespaces)
    }

    /// Real text only (#39): blocks like <system-reminder>…</system-reminder> or <pasted_content …>…, an unclosed one up to
    /// the end, and stray tags removed; the first piece left (its first line with `firstLine`), spaces collapsed.
    /// nil when nothing is left, never a raw tag.
    static func headline(_ s: String, firstLine: Bool = false) -> String? {
        let bare = s.replacingOccurrences(of: #"(?s)<([A-Za-z_][\w-]*)\b[^>]*>(.*?</\1\s*>|.*$)"#, with: "\u{0}", options: .regularExpression)
            .replacingOccurrences(of: #"</?[A-Za-z_][^>]*>"#, with: "\u{0}", options: .regularExpression)
        return bare.split(whereSeparator: { $0 == "\u{0}" || (firstLine && $0.isNewline) }).lazy
            .map { $0.split(whereSeparator: \.isWhitespace).joined(separator: " ") }
            .first { !$0.isEmpty }
    }
}
