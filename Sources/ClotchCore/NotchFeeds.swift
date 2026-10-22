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
    public let state: String          // nuova|presa|fatta
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
    /// The session that took it in charge, set by `GoalLoader` from `localId`, else from `takenBy` (its cli id); nil when not taken or unknown.
    public var target: SessionTarget? = nil

    /// Struck through in the view once a session has taken it in charge.
    public var taken: Bool { state == "presa" || state == "fatta" }

    /// How a request looks, the one place that decides it (#39, #67): taken = yellow «In lavorazione», never struck
    /// nor green; struck, ticked and green only once done. Every view reads label, struck and ink from here.
    public enum Look: Equatable, Sendable {
        case waiting, working, done
        public enum Ink: Equatable, Sendable { case quiet, wait, go }
        public var label: String { switch self { case .waiting: "In attesa"; case .working: "In lavorazione"; case .done: "Fatta" } }
        public var struck: Bool { self == .done }
        public var ink: Ink { switch self { case .waiting: .quiet; case .working: .wait; case .done: .go } }
    }

    public var look: Look { state == "fatta" ? .done : state == "presa" ? .working : .waiting }

    public var isQuestion: Bool { kind == "domanda" }
    public var answered: Bool { !answer.isEmpty }

    /// Label under the look: a question never «takes charge», it waits for its answer (#90).
    public var statusLabel: String { isQuestion ? (answered ? "Risposta" : "In attesa di risposta") : look.label }

    /// The tasks Roberto still waits on (zone count, taken ones are announced once, then hidden).
    public static func waiting(_ all: [UserRequest]) -> [UserRequest] { all.filter { !$0.isQuestion && !$0.taken } }

    /// How long an answered request stays in the Requests tab.
    public static let answerStays: TimeInterval = 48 * 3600

    /// What the Requests tab lists (#90): everything not taken (tasks waiting, questions without answer), plus every
    /// request with an answer from the last 48 hours; a question that is closed without an answer is not listed.
    public static func listed(_ all: [UserRequest], now: Date) -> [UserRequest] {
        all.filter { r in
            r.answered ? now.timeIntervalSince(r.answeredAt ?? r.at ?? now) < answerStays : !r.taken
        }
    }

    /// An answer written after Roberto last opened the tab (#90).
    public func isNewAnswer(since seen: Date) -> Bool { answered && (answeredAt ?? .distantPast) > seen }

    /// Ids to play the «presa in carico» animation for: taken now, seen as nuova (or not seen at all) on the
    /// previous load, not shown yet. The first load (`before` nil) is the baseline: nothing animates at launch.
    public static func newlyTaken(before: [UserRequest]?, after: [UserRequest], shown: Set<String>) -> [String] {
        guard let before else { return [] }
        let was = Dictionary(before.map { ($0.id, $0.taken) }, uniquingKeysWith: { a, _ in a })
        return after.filter { !$0.isQuestion && $0.taken && was[$0.id] != true && !shown.contains($0.id) }.map(\.id)
    }
}

extension GoalSources {
    /// A note (`tipo` "nota", claude-config#1825) never shows. A question (`tipo` "domanda") does since #90, but is never
    /// «taken in charge» (`isQuestion`). No `tipo` = a task. The one place that reads the file.
    public static func parseRequest(_ data: Data) -> UserRequest? {
        guard let d = object(data), let id = d["id"] as? String, !id.isEmpty,
              let text = d["testo"] as? String,
              d["tipo"] as? String != "nota" else { return nil }
        return UserRequest(id: id, at: date(d["t"]), session: d["sessione"] as? String ?? "",
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
