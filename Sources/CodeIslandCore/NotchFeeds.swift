import Foundation

// Account usage and Roberto's requests for the notch. Same rules as GoalSources: read-only,
// a missing or broken file is "no data", never an error. The API is never called.

public struct UsageWindow: Equatable, Sendable {
    public let used: Double   // percent, 0...100
    public let reset: Date?
}

/// One ~/.cache/claude-accounts/uso-acct-<id>.json, as claude_accounts_uso.py writes it.
public struct AccountUsage: Identifiable, Equatable, Sendable {
    public let id: String          // account uuid, from the file name
    public let at: Date?           // when the numbers were read: the view judges their age
    public let fiveHour: UsageWindow?
    public let sevenDay: UsageWindow?
    public let expired: Bool       // "scaduto": the login must be renewed
    public let reason: String?     // "motivo": why the numbers are missing or stale
}

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

    /// Struck through in the view once a session has taken it in charge.
    public var taken: Bool { state == "presa" || state == "fatta" }

    /// Ids to play the «presa in carico» animation for: taken now, seen as nuova (or not seen at all) on the
    /// previous load, not shown yet. The first load (`before` nil) is the baseline: nothing animates at launch.
    public static func newlyTaken(before: [UserRequest]?, after: [UserRequest], shown: Set<String>) -> [String] {
        guard let before else { return [] }
        let was = Dictionary(before.map { ($0.id, $0.taken) }, uniquingKeysWith: { a, _ in a })
        return after.filter { $0.taken && was[$0.id] != true && !shown.contains($0.id) }.map(\.id)
    }
}

extension GoalSources {
    /// `fileName` is `uso-acct-<id>.json`; temp files (`*.json.<pid>`) and locks never get here.
    public static func parseUsage(_ data: Data, fileName: String) -> AccountUsage? {
        guard let d = object(data), fileName.hasPrefix("uso-acct-"), fileName.hasSuffix(".json") else { return nil }
        func window(_ key: String) -> UsageWindow? {
            guard let w = d[key] as? [String: Any], let used = (w["usato"] as? NSNumber)?.doubleValue else { return nil }
            return UsageWindow(used: used, reset: date(w["reset"]))
        }
        return AccountUsage(id: String(fileName.dropFirst(9).dropLast(5)), at: date(d["at"]),
                            fiveHour: window("five_hour"), sevenDay: window("seven_day"),
                            expired: d["scaduto"] as? Bool ?? false, reason: d["motivo"] as? String)
    }

    public static func parseRequest(_ data: Data) -> UserRequest? {
        guard let d = object(data), let id = d["id"] as? String, !id.isEmpty,
              let text = d["testo"] as? String else { return nil }
        return UserRequest(id: id, at: date(d["t"]), session: d["sessione"] as? String ?? "",
                           sessionTitle: GoalBoard.clean(d["titolo_sessione"] as? String ?? ""),
                           text: text.split(whereSeparator: \.isWhitespace).joined(separator: " "),
                           original: d["originale"] as? String ?? text,
                           state: d["stato"] as? String ?? "nuova", takenAt: date(d["t_presa"]),
                           takenBy: d["presa_da"] as? String ?? "", doneAt: date(d["t_fatta"]),
                           proof: d["prova"] as? String ?? "", notOurs: d["non_nostra"] as? Bool ?? false,
                           folder: d["cartella"] as? String ?? "")
    }
}
