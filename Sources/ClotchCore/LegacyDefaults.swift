import Foundation

/// Settings saved before the app became Clotch (issue #30) live under the old
/// bundle id. A new bundle id starts from an empty domain, so they are copied
/// over once, at the first launch, before anything reads UserDefaults.
public enum LegacyDefaults {
    public static let oldDomain = "com.squadd.goalnotch"
    static let copiedKey = "clotch.copiedLegacyDefaults"

    /// Copies every key of `old` that `defaults` does not hold yet, then marks
    /// the copy done so it never runs again. Sparkle's own state (`SU…`) stays
    /// behind: Clotch has no updater to hand it to.
    public static func copyOnce(from old: [String: Any]?, into defaults: UserDefaults) {
        guard !defaults.bool(forKey: copiedKey) else { return }
        for (key, value) in old ?? [:] where !key.hasPrefix("SU") && defaults.object(forKey: key) == nil {
            defaults.set(value, forKey: key)
        }
        defaults.set(true, forKey: copiedKey)
    }

    /// Keys that kept the old name until issue #69, mapped to the Clotch name.
    static let renamedKeys = ["goalnotch.rejectedProposals": "clotch.rejectedProposals",
                              "goalnotch.seenMergedPRs": "clotch.seenMergedPRs"]

    /// Moves each old key to its new name (never over a value already there) and drops the old one.
    public static func renameKeys(in defaults: UserDefaults) {
        for (old, new) in renamedKeys {
            guard let value = defaults.object(forKey: old) else { continue }
            if defaults.object(forKey: new) == nil { defaults.set(value, forKey: new) }
            defaults.removeObject(forKey: old)
        }
    }
}
