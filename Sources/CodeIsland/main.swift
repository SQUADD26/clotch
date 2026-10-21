import CodeIslandCore
import Foundation

// Before anything reads UserDefaults (L10n.shared, AppState): bring over the Goal Notch settings once.
LegacyDefaults.copyOnce(from: UserDefaults.standard.persistentDomain(forName: LegacyDefaults.oldDomain), into: .standard)
NotchTiming.migrate(.standard)  // the old speed multipliers become times in ms (#68)
CodeIslandApp.main()
