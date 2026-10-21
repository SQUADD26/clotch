import ClotchCore
import Foundation

// Before anything reads UserDefaults (L10n.shared, AppState): bring over the Goal Notch settings once.
LegacyDefaults.copyOnce(from: UserDefaults.standard.persistentDomain(forName: LegacyDefaults.oldDomain), into: .standard)
LegacyDefaults.renameKeys(in: .standard)
// The parse cache moved to «Clotch» (#69): the old folder holds only a stale copy of it.
try? FileManager.default.removeItem(at: FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent("Library/Application Support/Goal Notch"))
NotchTiming.migrate(.standard)  // the old speed multipliers become times in ms (#68)
ClotchApp.main()
