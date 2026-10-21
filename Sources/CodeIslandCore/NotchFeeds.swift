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
    public var name: String? = nil // from ~/.config/claude-accounts/accounts.json, nil when unknown

    /// What the view shows: the account name, else a short id. An unknown account is never hidden.
    public var label: String { name ?? (id.contains("@") ? id : String(id.prefix(8))) }
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

    /// uuid or email -> account name. Reads accounts.json ({"accounts": {name: {config, email, …}}} or the bare map)
    /// and, of each config's .claude.json, only "oauthAccount". Never securestorage, never a token.
    static func accountNames(home: URL) -> [String: String] {
        let file = home.appendingPathComponent(".config/claude-accounts/accounts.json")
        guard let root = (try? Data(contentsOf: file)).flatMap(object) else { return [:] }
        let accounts = root["accounts"] as? [String: Any] ?? root
        var out: [String: String] = [:]
        for (name, v) in accounts.sorted(by: { $0.key < $1.key }) {
            guard let a = v as? [String: Any] else { continue }
            if let e = a["email"] as? String { out[e] = out[e] ?? name }  // declared: the login's own ids win
            guard let c = a["config"] as? String else { continue }
            let dir = c.hasPrefix("~/") ? home.appendingPathComponent(String(c.dropFirst(2))) : URL(fileURLWithPath: c)
            // Same rule as claude_accounts.login_json: plain ~/.claude logs in through ~/.claude.json.
            let login = dir.standardizedFileURL.path == home.appendingPathComponent(".claude").standardizedFileURL.path
                ? home.appendingPathComponent(".claude.json") : dir.appendingPathComponent(".claude.json")
            let o = oauthAccount(login)
            for k in ["accountUuid", "emailAddress"] { if let id = o[k] as? String, !id.isEmpty { out[id] = name } }
        }
        return out
    }

    /// Second source of account names: the desktop app keeps one folder per account,
    /// `Application Support/Claude-<name>/claude-code-sessions/<account uuid>/`. Plain `Claude` has no name.
    static func desktopAccountNames(sessionRoots: [URL]) -> [String: String] {
        var out: [String: String] = [:]
        for root in sessionRoots {
            let app = root.deletingLastPathComponent().lastPathComponent
            guard app.lowercased().hasPrefix("claude-"), app.count > 7 else { continue }
            let name = String(app.dropFirst(7))
            for id in (try? FileManager.default.contentsOfDirectory(atPath: root.path)) ?? [] where UUID(uuidString: id) != nil {
                out[id] = out[id] ?? name
            }
        }
        return out
    }

    /// The flat "oauthAccount" object of a .claude.json, cut out and parsed alone: the file holds megabytes
    /// of project history and is re-read on every load.
    static func oauthAccount(_ url: URL) -> [String: Any] {
        guard let data = try? Data(contentsOf: url, options: .alwaysMapped),
              let key = data.range(of: Data(#""oauthAccount""#.utf8)),
              let open = data[key.upperBound...].firstIndex(of: UInt8(ascii: "{")),
              data[key.upperBound..<open].allSatisfy({ " \t\r\n:".utf8.contains($0) }),
              let close = data[open...].firstIndex(of: UInt8(ascii: "}")) else { return [:] }
        return object(Data(data[open...close])) ?? [:]
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
