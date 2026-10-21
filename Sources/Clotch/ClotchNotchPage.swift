import SwiftUI
import AppKit
import ClotchCore

/// «Notch» (#30, #56): how the notch opens, what it shows, its tabs, the voice light, where it sits.
struct ClotchNotchPage: View {
    @ObservedObject private var l10n = L10n.shared
    @AppStorage(ClotchPrefs.openOnHover) private var openOnHover = ClotchPrefs.openOnHoverDefault
    @AppStorage(SettingsKey.hoverExpandDelay) private var hoverExpandDelay = SettingsDefaults.hoverExpandDelay
    @AppStorage(SettingsKey.collapseOnMouseLeave) private var collapseOnMouseLeave = SettingsDefaults.collapseOnMouseLeave
    @AppStorage(SettingsKey.hapticOnHover) private var hapticOnHover = SettingsDefaults.hapticOnHover
    @AppStorage(SettingsKey.notchOpenMs) private var notchOpenMs = SettingsDefaults.notchOpenMs
    @AppStorage(SettingsKey.notchCloseMs) private var notchCloseMs = SettingsDefaults.notchCloseMs
    @AppStorage(ClotchPrefs.hiddenTabs) private var hiddenTabs = ClotchPrefs.hiddenTabsDefault
    @AppStorage(ClotchPrefs.voiceLight) private var voiceLight = ClotchPrefs.voiceLightDefault
    @AppStorage(ClotchPrefs.voiceLightStrength) private var voiceLightStrength = ClotchPrefs.voiceLightStrengthDefault
    @AppStorage(SettingsKey.allowHorizontalDrag) private var allowHorizontalDrag = SettingsDefaults.allowHorizontalDrag
    @AppStorage(SettingsKey.avoidMenuBarIcons) private var avoidMenuBarIcons = SettingsDefaults.avoidMenuBarIcons

    var body: some View {
        Form {
            Section(l10n["opening"]) {
                Toggle(isOn: $openOnHover) {
                    Text(l10n["open_on_hover"])
                    Text(l10n["open_on_hover_desc"])
                }
                slider(l10n["hover_expand_delay"], value: Binding(
                    get: { NotchHoverInteraction.expandDelay(forSetting: hoverExpandDelay) },
                    set: { hoverExpandDelay = NotchHoverInteraction.expandDelay(forSetting: $0) }
                ), in: NotchHoverInteraction.expandDelayRange, step: NotchHoverInteraction.expandDelayStep) {
                    String(format: l10n["hover_expand_delay_value"], $0)
                }
                .disabled(!openOnHover)
                Toggle(l10n["collapse_on_mouse_leave"], isOn: $collapseOnMouseLeave)
                Toggle(l10n["haptic_on_hover"], isOn: $hapticOnHover)
                NotchTimeField(title: l10n["notch_open_ms"], ms: $notchOpenMs)
                NotchTimeField(title: l10n["notch_close_ms"], ms: $notchCloseMs)
            }

            Section(l10n["closed_notch"]) {
                LabeledContent {
                    Button(l10n["customize_notch"]) { NotchCustomizeWindowController.shared.show() }
                } label: {
                    Text(l10n["closed_notch_content"])
                    Text(l10n["closed_notch_desc"])
                }
            }

            Section {
                ForEach(NotchTab.allCases) { tab in
                    Toggle(l10n["tab_" + tab.rawValue], isOn: Binding(
                        get: { ClotchPrefs.visibleTabs(NotchTab.allCases.map(\.rawValue), hidden: hiddenTabs).contains(tab.rawValue) },
                        set: { hiddenTabs = ClotchPrefs.setTab(tab.rawValue, on: $0, hidden: hiddenTabs, all: NotchTab.allCases.map(\.rawValue)) }
                    ))
                }
            } header: {
                Text(l10n["tabs"])
            } footer: {
                Text(l10n["tabs_desc"])
            }

            Section(l10n["voice_light"]) {
                Toggle(isOn: $voiceLight) {
                    Text(l10n["voice_light"])
                    Text(l10n["voice_light_desc"])
                }
                slider(l10n["voice_light_strength"], value: Binding(
                    get: { ClotchPrefs.strength(voiceLightStrength) },
                    set: { voiceLightStrength = ClotchPrefs.strength($0) }
                ), in: ClotchPrefs.voiceLightStrengthRange, step: 0.05) { "\(Int(($0 * 100).rounded()))%" }
                .disabled(!voiceLight)
            }

            Section(l10n["position"]) {
                Toggle(l10n["allow_horizontal_drag"], isOn: $allowHorizontalDrag)
                    .onChange(of: allowHorizontalDrag) { _, enabled in
                        if !enabled { SettingsManager.shared.panelHorizontalOffset = 0 }
                    }
                Toggle(l10n["avoid_menu_bar_icons"], isOn: $avoidMenuBarIcons)
            }
        }
    }

    /// Label left; slider and its value right, as the Finder's rows.
    private func slider(_ title: String, value: Binding<Double>, in range: ClosedRange<Double>, step: Double,
                        format: @escaping (Double) -> String) -> some View {
        LabeledContent(title) {
            HStack {
                Slider(value: value, in: range, step: step).frame(width: 160).accessibilityLabel(Text(title))
                Text(format(value.wrappedValue)).foregroundStyle(.secondary).monospacedDigit().frame(width: 52, alignment: .trailing)
            }
        }
    }
}
