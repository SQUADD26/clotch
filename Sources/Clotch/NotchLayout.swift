import ClotchCore
import Foundation

/// What the user can put in the notch. The notch views read the stored layout; this file only holds it.
enum NotchElement: String, Codable, CaseIterable {
    case goalRings, activeGoal, accounts, accountsWide, pendingRequests, workingSessions
}

enum NotchZone: String, CaseIterable {
    case left, centre, right
}

struct NotchScreenLayout: Codable, Equatable {
    var left: [NotchElement]
    var centre: [NotchElement]
    var right: [NotchElement]
    /// How far the closed notch covers the menu bar: 0 = only as wide as its elements, 1 = the widest it goes.
    var width: Double
    /// «Solo icone»: the elements drop their words. Optional so layouts saved before it still load.
    var iconsOnly: Bool? = nil

    /// The approved closed notch (Figma 01, 09): rings left, account bars right, and on a screen
    /// without a notch the active goal in the centre; only as wide as its elements.
    static func standard(hasNotch: Bool) -> NotchScreenLayout {
        NotchScreenLayout(
            left: [.goalRings],
            centre: hasNotch ? [] : [.activeGoal],
            right: [.accounts],
            width: 0
        )
    }

    /// L10n key of the sentence that says how much of the menu bar the notch covers.
    var widthKey: String {
        width < 1.0 / 3 ? "notch_width_low" : width < 2.0 / 3 ? "notch_width_mid" : "notch_width_high"
    }

    private static func path(_ zone: NotchZone) -> WritableKeyPath<NotchScreenLayout, [NotchElement]> {
        switch zone {
        case .left: return \.left
        case .centre: return \.centre
        case .right: return \.right
        }
    }

    func elements(in zone: NotchZone) -> [NotchElement] { self[keyPath: Self.path(zone)] }

    func contains(_ element: NotchElement) -> Bool {
        NotchZone.allCases.contains { elements(in: $0).contains(element) }
    }

    /// An element sits in one place at most: placing it again moves it. False = the zone is unusable (centre on a notch screen).
    @discardableResult
    mutating func place(_ element: NotchElement, in zone: NotchZone, hasNotch: Bool) -> Bool {
        if zone == .centre && hasNotch { return false }
        remove(element)
        self[keyPath: Self.path(zone)].append(element)
        return true
    }

    mutating func remove(_ element: NotchElement) {
        for zone in NotchZone.allCases {
            self[keyPath: Self.path(zone)].removeAll { $0 == element }
        }
    }

    /// What the notch views draw: on a notch screen, centre elements join the left side.
    func resolved(hasNotch: Bool) -> NotchScreenLayout {
        guard hasNotch, !centre.isEmpty else { return self }
        var result = self
        result.left += centre
        result.centre = []
        return result
    }
}

/// One layout per screen, keyed by `ScreenDetector.signature`. A screen with no entry gets the standard layout.
struct NotchLayoutStore: Codable, Equatable {
    var screens: [String: NotchScreenLayout] = [:]

    func layout(for signature: String, hasNotch: Bool) -> NotchScreenLayout {
        screens[signature] ?? .standard(hasNotch: hasNotch)
    }

    static func load(from defaults: UserDefaults = .standard) -> NotchLayoutStore {
        defaults.data(forKey: SettingsKey.notchLayouts)
            .flatMap { try? JSONDecoder().decode(NotchLayoutStore.self, from: $0) } ?? NotchLayoutStore()
    }

    func save(to defaults: UserDefaults = .standard) {
        defaults.set(try? JSONEncoder().encode(self), forKey: SettingsKey.notchLayouts)
    }

    /// The old «Larghezza isola» joins «Larghezza» once (#99): on every saved layout and on the screens attached now.
    static func migrateWidthScale(_ defaults: UserDefaults = .standard, screens: [(signature: String, hasNotch: Bool)]) {
        guard defaults.object(forKey: NotchWidth.oldScaleKey) != nil else { return }
        let scale = defaults.integer(forKey: NotchWidth.oldScaleKey)
        defaults.removeObject(forKey: NotchWidth.oldScaleKey)
        guard NotchWidth.fraction(fromScale: scale) > 0 else { return }
        var store = load(from: defaults)
        for screen in screens where store.screens[screen.signature] == nil {
            store.screens[screen.signature] = .standard(hasNotch: screen.hasNotch)
        }
        store.screens = store.screens.mapValues { layout in
            var layout = layout
            layout.width = NotchWidth.merged(width: layout.width, scale: scale)
            return layout
        }
        store.save(to: defaults)
    }
}
