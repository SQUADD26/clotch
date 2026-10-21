import Foundation

/// Clotch's one Claude Code hook (#50): at Stop it hands the hook payload to Clotch and returns at once. Same road as
/// CodeIsland's installer (a command in `settings.json` → `hooks`, found again by its command), but only Stop and only
/// while Clotch's voice is on: CodeIsland's socket server would also take over permissions and sessions, which Clotch never shows.
public enum VoiceHooks {
    /// What `settings.json` runs; also the marker that finds the entry again.
    public static let command = "~/.clotch/voce-stop.sh"
    public static let scriptPath = ".clotch/voce-stop.sh"

    /// Never blocks or fails the turn. Writes the payload into `~/.config/voce/coda` only if the Clotch that wrote
    /// `clotch-attiva` (its pid) is alive, and never for Clotch's own Haiku call (CLOTCH_VOCE_INTERNA).
    public static let script = """
        #!/bin/bash
        # Clotch voice (goal-notch#50): hands the Stop payload to Clotch. Nothing when Clotch is not running with its voice on.
        [ -n "$CLOTCH_VOCE_INTERNA" ] && exit 0
        d="$HOME/.config/voce"
        p=$(cat "$d/clotch-attiva" 2>/dev/null) && kill -0 "$p" 2>/dev/null || exit 0
        mkdir -p "$d/coda" && t="$d/coda/.$$.tmp" && cat > "$t" && mv -f "$t" "$d/coda/$(date +%s)-$$.json"
        exit 0

        """

    private static func isOurs(_ entry: Any) -> Bool {
        ((entry as? [String: Any])?["hooks"] as? [[String: Any]])?.contains { ($0["command"] as? String) == command } == true
    }

    /// The `hooks` object with Clotch's Stop entry; nil when it is already there (installed once).
    public static func adding(to hooks: [String: Any]) -> [String: Any]? {
        var stop = hooks["Stop"] as? [Any] ?? []
        guard !stop.contains(where: isOurs) else { return nil }
        stop.append(["matcher": "", "hooks": [["type": "command", "command": command, "timeout": 5]]])
        var out = hooks
        out["Stop"] = stop
        return out
    }

    /// The `hooks` object without Clotch's entries, every other hook kept; nil when there were none.
    public static func removing(from hooks: [String: Any]) -> [String: Any]? {
        guard let stop = hooks["Stop"] as? [Any], stop.contains(where: isOurs) else { return nil }
        var out = hooks
        let rest = stop.filter { !isOurs($0) }
        out["Stop"] = rest.isEmpty ? nil : rest
        return out
    }

    /// Every Claude Code config folder of this user: `~/.claude` and one `~/.claude-<account>` per account, each once
    /// (a symlink to another is skipped). Only folders that hold a `settings.json` or a `projects/`.
    public static func configDirs(home: URL, fm: FileManager = .default) -> [URL] {
        let names = ((try? fm.contentsOfDirectory(atPath: home.path)) ?? []).filter { $0 == ".claude" || $0.hasPrefix(".claude-") }.sorted()
        var seen = Set<String>()
        return names.map { home.appendingPathComponent($0) }.filter { dir in
            var isDir: ObjCBool = false
            guard fm.fileExists(atPath: dir.path, isDirectory: &isDir), isDir.boolValue,
                  fm.fileExists(atPath: dir.appendingPathComponent("settings.json").path)
                    || fm.fileExists(atPath: dir.appendingPathComponent("projects").path) else { return false }
            return seen.insert(dir.resolvingSymlinksInPath().path).inserted
        }
    }
}
