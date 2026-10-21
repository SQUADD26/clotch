import Foundation

// Roberto's requests for the notch. Same rules as GoalSources: read-only,
// a missing or broken file is "no data", never an error. The API is never called.

/// One ~/.claude/richieste/<id>.json, as claude-config richieste.py writes it (#1720). Times are epoch seconds or ISO.
public struct UserRequest: Identifiable, Equatable, Sendable {
    public let id: String             // "Q-xxxxxxxx"
    public let at: Date?
    public let session: String        // cli id
    public let sessionTitle: String   // signs and emoji removed, like goal titles
    public let text: String           // short, imperative
    public let original: String       // Roberto's words, verbatim
    public let state: String          // nuova|presa|fatta
    public let takenAt: Date?
    public let takenBy: String
    public let doneAt: Date?
    public let proof: String          // #PR / sha, or the reason it was closed
    public let notOurs: Bool
    public let folder: String
    public let localId: String        // app id (`local_…`) of the session that took it; "" while the register does not know it
    /// The session that took it in charge, set by `GoalLoader` from `localId`, else from `takenBy` (its cli id); nil when not taken or unknown.
    public var target: SessionTarget? = nil

    /// Struck through in the view once a session has taken it in charge.
    public var taken: Bool { state == "presa" || state == "fatta" }

    /// How a request looks, the one place that decides it (#39): taken = at work, never struck; struck and ticked only once done.
    public enum Look: Equatable, Sendable {
        case waiting, working, done
        public var label: String { switch self { case .waiting: "In attesa"; case .working: "Presa in carico"; case .done: "Fatta" } }
        public var struck: Bool { self == .done }
    }

    public var look: Look { state == "fatta" ? .done : state == "presa" ? .working : .waiting }

    /// The requests Roberto still waits on: the Requests tab shows only these (taken ones are announced once, then hidden).
    public static func waiting(_ all: [UserRequest]) -> [UserRequest] { all.filter { !$0.taken } }

    /// Ids to play the «presa in carico» animation for: taken now, seen as nuova (or not seen at all) on the
    /// previous load, not shown yet. The first load (`before` nil) is the baseline: nothing animates at launch.
    public static func newlyTaken(before: [UserRequest]?, after: [UserRequest], shown: Set<String>) -> [String] {
        guard let before else { return [] }
        let was = Dictionary(before.map { ($0.id, $0.taken) }, uniquingKeysWith: { a, _ in a })
        return after.filter { $0.taken && was[$0.id] != true && !shown.contains($0.id) }.map(\.id)
    }
}

extension GoalSources {
    public static func parseRequest(_ data: Data) -> UserRequest? {
        guard let d = object(data), let id = d["id"] as? String, !id.isEmpty,
              let text = d["testo"] as? String else { return nil }
        return UserRequest(id: id, at: date(d["t"]), session: d["sessione"] as? String ?? "",
                           sessionTitle: GoalBoard.clean(d["titolo_sessione"] as? String ?? ""),
                           text: headline(text) ?? headline(d["originale"] as? String ?? "", firstLine: true) ?? "una richiesta",
                           original: d["originale"] as? String ?? text,
                           state: d["stato"] as? String ?? "nuova", takenAt: date(d["t_presa"]),
                           takenBy: d["presa_da"] as? String ?? "", doneAt: date(d["t_fatta"]),
                           proof: d["prova"] as? String ?? "", notOurs: d["non_nostra"] as? Bool ?? false,
                           folder: d["cartella"] as? String ?? "", localId: d["local_id"] as? String ?? "")
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
