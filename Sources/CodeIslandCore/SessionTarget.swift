import Foundation

/// A Claude desktop session a notch row opens on click (a goal's master, the session that took a request).
/// The app exists in one copy per account, each with its own data folder, and a session lives in only one:
/// `profile` names that folder so the click opens the copy that owns it.
public struct SessionTarget: Equatable, Sendable {
    public let localId: String
    /// `…/Application Support/Claude-x`; "" when unknown (the default app handles the link).
    public let profile: String

    public init(localId: String, profile: String) {
        self.localId = localId
        self.profile = profile
    }

    /// `claude://claude.ai/epitaxy/local_<id>`; nil unless the id has the shape the app accepts, so a click never opens a guess.
    public var url: URL? {
        ClaudeDesktopCodeSession.isValidHostSessionId(localId) ? URL(string: "claude://claude.ai/epitaxy/\(localId)") : nil
    }

    /// The data folder of an app copy `Claude <email>.app`: its launcher script fixes it with
    /// `--user-data-dir="$HOME/Library/Application Support/Claude-x"` (the rule of claude-config `claude_accounts_app.py`).
    /// A session file `<profile>/claude-code-sessions/<a>/<b>/local_x.json` carries the same folder, so equal strings = same copy.
    public static func dataDir(launcher: String, home: String) -> String? {
        guard let start = launcher.range(of: "--user-data-dir=\"") else { return nil }
        let rest = launcher[start.upperBound...]
        guard let end = rest.firstIndex(of: "\"") else { return nil }
        return normalized(String(rest[..<end]).replacingOccurrences(of: "$HOME", with: home))
    }

    /// The profile folder of a session file path; "" when the path is not under a `claude-code-sessions` folder.
    public static func profile(ofSessionFile path: String) -> String {
        guard let r = path.range(of: "/claude-code-sessions/") else { return "" }
        return normalized(String(path[..<r.lowerBound]))
    }

    private static func normalized(_ path: String) -> String {
        path.hasSuffix("/") ? String(path.dropLast()) : path
    }
}
