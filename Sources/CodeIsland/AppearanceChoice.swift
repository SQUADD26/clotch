import AppKit

/// Look of the Settings and «Personalizza il notch» windows. Dark unless the user picks otherwise.
enum AppearanceChoice: String, CaseIterable {
    case dark, light, system

    static func read(from defaults: UserDefaults = .standard) -> AppearanceChoice {
        defaults.string(forKey: SettingsKey.windowAppearance).flatMap(AppearanceChoice.init(rawValue:)) ?? .dark
    }

    /// nil = follow the system.
    var nsAppearance: NSAppearance? {
        switch self {
        case .dark: return NSAppearance(named: .darkAqua)
        case .light: return NSAppearance(named: .aqua)
        case .system: return nil
        }
    }
}
