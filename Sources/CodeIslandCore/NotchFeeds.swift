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
    public let email: String?      // the verified owner of the login: how an account is shown
}

/// One ~/.claude/richieste/<id>.json
public struct UserRequest: Identifiable, Equatable, Sendable {
    public let id: String
    public let at: Date?
    public let session: String
    public let sessionTitle: String   // signs and emoji removed, like goal titles
    public let text: String
    public let state: String          // nuova|presa|fatta
    public let takenAt: Date?
    public let takenBy: String
    public let doneAt: Date?

    /// Struck through in the view once a session has taken it in charge.
    public var taken: Bool { state == "presa" || state == "fatta" }
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
                            expired: d["scaduto"] as? Bool ?? false, reason: d["motivo"] as? String,
                            email: d["email"] as? String)
    }

    public static func parseRequest(_ data: Data) -> UserRequest? {
        guard let d = object(data), let id = d["id"] as? String, !id.isEmpty,
              let text = d["testo"] as? String else { return nil }
        return UserRequest(id: id, at: date(d["t"]), session: d["sessione"] as? String ?? "",
                           sessionTitle: GoalBoard.clean(d["titolo_sessione"] as? String ?? ""),
                           text: text.split(whereSeparator: \.isWhitespace).joined(separator: " "),
                           state: d["stato"] as? String ?? "nuova", takenAt: date(d["t_presa"]),
                           takenBy: d["presa_da"] as? String ?? "", doneAt: date(d["t_fatta"]))
    }
}
