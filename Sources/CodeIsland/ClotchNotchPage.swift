import SwiftUI
import AppKit

/// Clotch's one settings page: only what drives the notch (#30). The CodeIsland
/// pages stay in SettingsView.swift, off the sidebar.
struct ClotchNotchPage: View {
    @ObservedObject private var l10n = L10n.shared
    @AppStorage(SettingsKey.displayChoice) private var displayChoice = SettingsDefaults.displayChoice
    @AppStorage(SettingsKey.windowAppearance) private var windowAppearance = AppearanceChoice.dark.rawValue
    @AppStorage(SettingsKey.allowHorizontalDrag) private var allowHorizontalDrag = SettingsDefaults.allowHorizontalDrag
    @AppStorage(SettingsKey.avoidMenuBarIcons) private var avoidMenuBarIcons = SettingsDefaults.avoidMenuBarIcons
    @AppStorage(SettingsKey.collapsedWidthScale) private var collapsedWidthScale = SettingsDefaults.collapsedWidthScale
    @AppStorage(SettingsKey.notchOpenSpeed) private var notchOpenSpeed = SettingsDefaults.notchOpenSpeed
    @AppStorage(SettingsKey.notchCloseSpeed) private var notchCloseSpeed = SettingsDefaults.notchCloseSpeed
    @State private var launchAtLogin: Bool

    init() {
        _launchAtLogin = State(initialValue: SettingsManager.shared.launchAtLogin)
    }

    var body: some View {
        Form {
            Section {
                Button(l10n["customize_notch"]) { NotchCustomizeWindowController.shared.show() }
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

            Section(l10n["panel"]) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(l10n["collapsed_width_scale"])
                        Spacer()
                        Text("\(collapsedWidthScale)%").foregroundStyle(.secondary).monospacedDigit()
                    }
                    Slider(value: Binding(
                        get: { Double(collapsedWidthScale) },
                        set: { collapsedWidthScale = Int($0) }
                    ), in: Double(NotchWidthScale.min)...Double(NotchWidthScale.max), step: Double(NotchWidthScale.step))
                }
                speedSlider(l10n["notch_open_speed"], $notchOpenSpeed)
                speedSlider(l10n["notch_close_speed"], $notchCloseSpeed)
                Toggle(l10n["allow_horizontal_drag"], isOn: $allowHorizontalDrag)
                    .onChange(of: allowHorizontalDrag) { _, enabled in
                        if !enabled { SettingsManager.shared.panelHorizontalOffset = 0 }
                    }
                Toggle(l10n["avoid_menu_bar_icons"], isOn: $avoidMenuBarIcons)
            }
        }
        .formStyle(.grouped)
    }

    private func speedSlider(_ title: String, _ speed: Binding<Double>) -> some View {
        let value = Binding(
            get: { NotchAnimationSpeed.clamped(speed.wrappedValue) },
            set: { speed.wrappedValue = NotchAnimationSpeed.clamped($0) }
        )
        return VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                Spacer()
                Text("\(value.wrappedValue, specifier: "%.1f")×").foregroundStyle(.secondary).monospacedDigit()
            }
            Slider(value: value, in: NotchAnimationSpeed.minimum...NotchAnimationSpeed.maximum, step: NotchAnimationSpeed.step)
                .accessibilityLabel(Text(title))
        }
    }
}
