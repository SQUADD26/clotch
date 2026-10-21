import SwiftUI
import AppKit
import CodeIslandCore

/// «Generale» (#56): screen, look, start at login.
struct ClotchGeneralPage: View {
    @ObservedObject private var l10n = L10n.shared
    @AppStorage(SettingsKey.displayChoice) private var displayChoice = SettingsDefaults.displayChoice
    @AppStorage(SettingsKey.windowAppearance) private var windowAppearance = AppearanceChoice.dark.rawValue
    @State private var launchAtLogin: Bool

    init() {
        _launchAtLogin = State(initialValue: SettingsManager.shared.launchAtLogin)
    }

    var body: some View {
        Form {
            Section {
                Picker(l10n["display"], selection: $displayChoice) {
                    Text(l10n["auto"]).tag("auto")
                    Text(l10n["follow_mouse"]).tag(ScreenDetector.followMouseChoice)
                    ForEach(Array(NSScreen.screens.enumerated()), id: \.offset) { _, screen in
                        let name = screen.localizedName
                        let isBuiltin = name.contains("Built-in") || name.contains("内置")
                        Text(isBuiltin ? l10n["builtin_display"] : name)
                            .tag(ScreenDetector.fixedPrefix + ScreenDetector.signature(for: screen))
                    }
                }
                Picker(l10n["window_appearance"], selection: $windowAppearance) {
                    Text(l10n["appearance_dark"]).tag(AppearanceChoice.dark.rawValue)
                    Text(l10n["appearance_light"]).tag(AppearanceChoice.light.rawValue)
                    Text(l10n["appearance_system"]).tag(AppearanceChoice.system.rawValue)
                }
                .onChange(of: windowAppearance) { _, _ in
                    SettingsWindowController.shared.applyAppearance()
                    NotchCustomizeWindowController.shared.applyAppearance()
                }
                Toggle(l10n["launch_at_login"], isOn: $launchAtLogin)
                    .onChange(of: launchAtLogin) { _, v in SettingsManager.shared.launchAtLogin = v }
            }
        }
    }
}

/// «Avvisi» (#56): the notifications under the closed notch, on or off, and how long each stays.
struct ClotchNotificationsPage: View {
    @ObservedObject private var l10n = L10n.shared
    @AppStorage(ClotchPrefs.notes) private var notes = ClotchPrefs.notesDefault
    @AppStorage(ClotchPrefs.noteLength) private var noteLength = ClotchPrefs.noteLengthDefault

    var body: some View {
        Form {
            Section {
                Toggle(isOn: $notes) {
                    Text(l10n["show_notifications"])
                    Text(l10n["show_notifications_desc"])
                }
                Picker(l10n["notification_length"], selection: $noteLength) {
                    ForEach(ClotchPrefs.NoteLength.allCases, id: \.self) { Text(l10n["length_" + $0.rawValue]).tag($0.rawValue) }
                }
                .disabled(!notes)
            }
        }
    }
}
