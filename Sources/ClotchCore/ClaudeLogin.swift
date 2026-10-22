import Foundation

/// Which account a `claude` started by Clotch runs as (#159). Clotch starts from the Dock with no CLAUDE_CONFIG_DIR, and
/// ~/.claude may have no login: every `claude` gets the folder of an account that does. Pure: the caller probes and runs.
public enum ClaudeLogin {
    /// Every Claude config folder on this Mac: the main one, the extras from Settings, then each `~/.claude-*` folder. Once each.
    public static func folders(home: String, primary: String, extras: [String], fm: FileManager = .default) -> [String] {
        let local = ((try? fm.contentsOfDirectory(atPath: home)) ?? []).filter { $0.hasPrefix(".claude-") }.sorted().map { home + "/" + $0 }
        var seen = Set<String>()
        return ([primary] + extras + local).filter { path in
            var dir: ObjCBool = false
            return fm.fileExists(atPath: path, isDirectory: &dir) && dir.boolValue && seen.insert(path).inserted
        }
    }

    /// The account email of a config folder, from its `.claude.json`.
    public static func email(folder: String) -> String? {
        guard let data = FileManager.default.contents(atPath: folder + "/.claude.json"),
              let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return nil }
        return (root["oauthAccount"] as? [String: Any])?["emailAddress"] as? String
    }

    /// The folders best first: the accounts with most margin (`ranked`, Macchine's order), then the rest as given.
    public static func ordered(_ folders: [String], ranked: [String], email: (String) -> String?) -> [String] {
        let rank = Dictionary(ranked.enumerated().map { ($1, $0) }, uniquingKeysWith: { a, _ in a })
        return folders.enumerated().sorted { a, b in
            let ra = email(a.element).flatMap { rank[$0] } ?? Int.max, rb = email(b.element).flatMap { rank[$0] } ?? Int.max
            return ra != rb ? ra < rb : a.offset < b.offset
        }.map(\.element)
    }

    /// The first folder `claude auth status` calls logged in; nil = no account can run `claude`.
    public static func pick(_ folders: [String], loggedIn: (String) -> Bool) -> String? {
        folders.first(where: loggedIn)
    }

    /// `claude auth status --json`: `"loggedIn": true`.
    public static func isLoggedIn(statusJSON: Data) -> Bool {
        ((try? JSONSerialization.jsonObject(with: statusJSON)) as? [String: Any])?["loggedIn"] as? Bool == true
    }

    /// A failed `claude` run, said for the bar. The full stderr goes to the log, never here.
    public enum Failure: Error, Equatable {
        case noBinary, noAccount, notLoggedIn, limit, timeout, empty, failed

        public var message: String {
            switch self {
            case .noBinary: return "Claude Code non trovato. Installalo e riprova."
            case .noAccount, .notLoggedIn: return "Nessun account Claude collegato. Esegui /login in Claude Code."
            case .limit: return "Limite di Claude raggiunto. Riprova più tardi."
            case .timeout: return "Claude non ha risposto in tempo. Riprova."
            case .empty: return "Nessuna risposta. Riprova."
            case .failed: return "Errore di Claude. Dettagli nel log di Clotch."
            }
        }
    }

    /// What a finished run means: its text, or why not.
    public static func outcome(status: Int32, timedOut: Bool, stdout: String, stderr: String) -> Result<String, Failure> {
        let text = stdout.trimmingCharacters(in: .whitespacesAndNewlines)
        if timedOut { return .failure(.timeout) }
        if status == 0 { return text.isEmpty ? .failure(.empty) : .success(text) }
        // `claude -p` prints its error on stdout or stderr depending on the kind: read both.
        let said = (stdout + "\n" + stderr).lowercased()
        if said.contains("not logged in") || said.contains("/login") || said.contains("401") || said.contains("invalid api key") {
            return .failure(.notLoggedIn)
        }
        if said.contains("limit") || said.contains("429") { return .failure(.limit) }
        return .failure(.failed)
    }
}
