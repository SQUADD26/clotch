import CodeIslandCore
import Foundation

// Before anything reads UserDefaults (L10n.shared, AppState): bring over the Goal Notch settings once.
LegacyDefaults.copyOnce(from: UserDefaults.standard.persistentDomain(forName: LegacyDefaults.oldDomain), into: .standard)
CodeIslandApp.main()
