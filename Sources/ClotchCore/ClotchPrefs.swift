import Foundation

/// Clotch's own settings (#56): choices that were fixed in code and that Roberto can now change in
/// Impostazioni. UserDefaults keys and defaults; the app reads them with `@AppStorage`.
public enum ClotchPrefs {
    /// The notch opens when the pointer rests on it; off = it opens on a click.
    public static let openOnHover = "clotchOpenOnHover"
    public static let openOnHoverDefault = true
    /// Notifications under the closed notch (goal changes, requests taken).
    public static let notes = "clotchNotes"
    public static let notesDefault = true
    /// How long a notification stays: `NoteLength` raw value.
    public static let noteLength = "clotchNoteLength"
    public static let noteLengthDefault = NoteLength.normal.rawValue
    /// Tabs of the open notch Roberto turned off, comma separated (`NotchTab` raw values).
    public static let hiddenTabs = "clotchHiddenTabs"
    public static let hiddenTabsDefault = ""
    /// The light on the notch while the Friday speaks, and its strength.
    public static let voiceLight = "clotchVoiceLight"
    public static let voiceLightDefault = true
    public static let voiceLightStrength = "clotchVoiceLightStrength"
    public static let voiceLightStrengthDefault = 1.0
    public static let voiceLightStrengthRange = 0.3...1.0
    /// AFK (#106): off by itself when Roberto is back at the Mac, and the summary said aloud.
    public static let afkEndOnReturn = "clotchAfkEndOnReturn"
    public static let afkEndOnReturnDefault = true
    public static let afkReadAloud = "clotchAfkReadAloud"
    public static let afkReadAloudDefault = true

    public enum NoteLength: String, CaseIterable, Sendable {
        case short, normal, long
        /// Multiplies `NotchEvents.hold(forText:)`.
        public var scale: Double {
            switch self {
            case .short: return 0.6
            case .normal: return 1
            case .long: return 1.6
            }
        }
    }

    public static func noteScale(_ raw: String) -> Double { (NoteLength(rawValue: raw) ?? .normal).scale }

    public static func strength(_ value: Double) -> Double {
        min(max(value, voiceLightStrengthRange.lowerBound), voiceLightStrengthRange.upperBound)
    }

    /// The tabs shown, in `all`'s order; never none: with every tab hidden, all show.
    public static func visibleTabs(_ all: [String], hidden raw: String) -> [String] {
        let hidden = Set(raw.split(separator: ",").map(String.init))
        let shown = all.filter { !hidden.contains($0) }
        return shown.isEmpty ? all : shown
    }

    /// `raw` with `tab` turned on or off. The last visible tab cannot be turned off.
    public static func setTab(_ tab: String, on: Bool, hidden raw: String, all: [String]) -> String {
        var hidden = Set(raw.split(separator: ",").map(String.init))
        if on { hidden.remove(tab) } else { hidden.insert(tab) }
        guard all.contains(where: { !hidden.contains($0) }) else { return raw }
        return all.filter(hidden.contains).joined(separator: ",")
    }
}
