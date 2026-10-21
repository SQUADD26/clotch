import SwiftUI
import AppKit
import ClotchCore

/// «Generale» (#56, Figma #95): screen, look, start at login.
struct ClotchGeneralPage: View {
    @ObservedObject private var l10n = L10n.shared
    @AppStorage(SettingsKey.displayChoice) private var displayChoice = SettingsDefaults.displayChoice
    @AppStorage(SettingsKey.windowAppearance) private var windowAppearance = AppearanceChoice.dark.rawValue
    @State private var launchAtLogin: Bool

    init() {
        _launchAtLogin = State(initialValue: SettingsManager.shared.launchAtLogin)
    }

    var body: some View {
        SettingsForm {
            SettingsRow(l10n["display"]) {
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
                .labelsHidden().frame(width: 220)
            }
            SettingsRow(l10n["window_appearance"]) {
                Picker(l10n["window_appearance"], selection: $windowAppearance) {
                    Text(l10n["appearance_dark"]).tag(AppearanceChoice.dark.rawValue)
                    Text(l10n["appearance_light"]).tag(AppearanceChoice.light.rawValue)
                    Text(l10n["appearance_system"]).tag(AppearanceChoice.system.rawValue)
                }
                .pickerStyle(.segmented).labelsHidden().fixedSize()
                .onChange(of: windowAppearance) { _, _ in
                    SettingsWindowController.shared.applyAppearance()
                    NotchCustomizeWindowController.shared.applyAppearance()
                }
            }
            Divider()
            SettingsRow(l10n["startup"]) {
                SettingsCheckbox(title: l10n["launch_at_login"], isOn: $launchAtLogin)
                    .onChange(of: launchAtLogin) { _, v in SettingsManager.shared.launchAtLogin = v }
            }
        }
    }
}

/// «Avvisi» (#56, Figma #95): the notifications under the closed notch, on or off, how long each stays, a preview.
struct ClotchNotificationsPage: View {
    @ObservedObject private var l10n = L10n.shared
    @AppStorage(ClotchPrefs.notes) private var notes = ClotchPrefs.notesDefault
    @AppStorage(ClotchPrefs.noteLength) private var noteLength = ClotchPrefs.noteLengthDefault

    var body: some View {
        SettingsForm {
            SettingsRow(l10n["notifications_page"]) {
                SettingsCheckbox(title: l10n["show_notifications"], note: l10n["show_notifications_desc"], isOn: $notes)
            }
            SettingsRow(l10n["notification_length"]) {
                Picker(l10n["notification_length"], selection: $noteLength) {
                    ForEach(ClotchPrefs.NoteLength.allCases, id: \.self) { Text(l10n["length_" + $0.rawValue]).tag($0.rawValue) }
                }
                .pickerStyle(.segmented).labelsHidden().fixedSize()
                .disabled(!notes)
            }
            Divider()
            SettingsRow(l10n["preview"]) {
                VStack(alignment: .leading, spacing: 0) {
                    ClosedNotchPreview(layout: NotchCustomizeView.currentLayout(), height: 34)
                    HStack(spacing: 8) {
                        Circle().fill(.green).frame(width: 8, height: 8)
                        Text(l10n["notification_sample_head"]).fontWeight(.medium).foregroundStyle(.white)
                        Text(l10n["notification_sample_goal"]).foregroundStyle(.white.opacity(0.6))
                    }
                    .font(.system(size: 11))
                    .padding(EdgeInsets(top: 2, leading: 14, bottom: 12, trailing: 14))
                }
                .frame(width: 334, alignment: .leading)
                .background(UnevenRoundedRectangle(bottomLeadingRadius: 12, bottomTrailingRadius: 12, style: .continuous).fill(.black))
                .opacity(notes ? 1 : 0.4)
            }
        }
    }
}
