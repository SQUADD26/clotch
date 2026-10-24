import Foundation

/// #1119: Clotch updates itself (`scripts/aggiorna.sh`); the first launch of a new build says it once, aloud.
public enum UpdateNotice {
    public static let key = "clotch.versioneDetta"

    /// The sentence for this launch, nil on the first launch ever and on a relaunch of the same build. Stores the build either way.
    public static func line(build: String, defaults: UserDefaults = .standard) -> String? {
        let said = defaults.string(forKey: key)
        defaults.set(build, forKey: key)
        guard let said, said != build, !build.isEmpty else { return nil }
        return "Mi sono aggiornata alla versione \(build)."
    }
}
