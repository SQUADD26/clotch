import SwiftUI
import AppKit
import ClotchCore

/// «Notch» (#30, #56, Figma #95): how the notch opens, how much of each screen's menu bar it covers, what the
/// closed notch shows, its tabs, the voice light.
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
    // Read through AppStorage so an edit in «Personalizza il notch» shows here at once.
    @AppStorage(SettingsKey.notchLayouts) private var layouts = Data()
    @State private var screen = NotchCustomizeView.initialSignature()
    @State private var customizing = false

    private var store: NotchLayoutStore { NotchLayoutStore.load() }
    private var layout: NotchScreenLayout { store.layout(for: screen, hasNotch: NotchCustomizeView.hasNotch(screen)) }

    var body: some View {
        let _ = layouts  // re-render on every layout write
        SettingsForm {
            SettingsRow(l10n["opening"]) {
                SettingsCheckbox(title: l10n["open_on_hover"], note: l10n["open_on_hover_desc"], isOn: $openOnHover)
                SettingsCheckbox(title: l10n["collapse_on_mouse_leave"], isOn: $collapseOnMouseLeave)
                SettingsCheckbox(title: l10n["haptic_on_hover"], isOn: $hapticOnHover)
            }
            SettingsRow(l10n["hover_delay"]) {
                SettingsSlider(value: Binding(
                    get: { NotchHoverInteraction.expandDelay(forSetting: hoverExpandDelay) },
                    set: { hoverExpandDelay = NotchHoverInteraction.expandDelay(forSetting: $0) }
                ), range: NotchHoverInteraction.expandDelayRange, step: NotchHoverInteraction.expandDelayStep,
                   ticks: [seconds(NotchHoverInteraction.expandDelayRange.lowerBound), seconds(NotchHoverInteraction.expandDelayRange.upperBound)],
                   shown: seconds(NotchHoverInteraction.expandDelay(forSetting: hoverExpandDelay)), label: l10n["hover_delay"])
                .disabled(!openOnHover)
            }
            msRow(l10n["notch_open_ms"], $notchOpenMs)
            msRow(l10n["notch_close_ms"], $notchCloseMs)
            Divider()
            SettingsRow(l10n["display"]) {
                Picker(l10n["display"], selection: $screen) {
                    ForEach(NSScreen.screens, id: \.self) { s in
                        Text(NotchCustomizeView.name(of: s)).tag(ScreenDetector.signature(for: s))
                    }
                }
                .labelsHidden().frame(width: 240)
            }
            SettingsRow(l10n["notch_width"]) {
                SettingsSlider(value: Binding(get: { layout.width }, set: { w in edit { $0.width = w } }), range: 0...1,
                               ticks: [l10n["notch_width_tick_low"], l10n["notch_width_tick_mid"], l10n["notch_width_tick_high"]],
                               width: 240, label: l10n["notch_width"])
                SettingsNote(l10n[layout.widthKey] + ". " + l10n["notch_width_this_screen"])
            }
            SettingsRow("") {
                SettingsCheckbox(title: l10n["avoid_menu_bar_icons"], note: l10n["avoid_menu_bar_icons_desc"], isOn: $avoidMenuBarIcons)
                SettingsCheckbox(title: l10n["drag_to_move"], isOn: $allowHorizontalDrag)
                    .onChange(of: allowHorizontalDrag) { _, enabled in
                        if !enabled { SettingsManager.shared.panelHorizontalOffset = 0 }
                    }
            }
            Divider()
            SettingsRow(l10n["closed_notch"], spacing: 10) {
                ClosedNotchPreview(layout: layout)
                Button(l10n["customize_button"]) { customizing = true }
            }
            Divider()
            SettingsRow(l10n["tabs"], spacing: 6) {
                ForEach(NotchTab.allCases) { tab in
                    SettingsCheckbox(title: l10n["tab_" + tab.rawValue], isOn: Binding(
                        get: { ClotchPrefs.visibleTabs(NotchTab.allCases.map(\.rawValue), hidden: hiddenTabs).contains(tab.rawValue) },
                        set: { hiddenTabs = ClotchPrefs.setTab(tab.rawValue, on: $0, hidden: hiddenTabs, all: NotchTab.allCases.map(\.rawValue)) }
                    ))
                }
                SettingsNote(l10n["tabs_desc"])
            }
            Divider()
            SettingsRow(l10n["voice_light"], spacing: 10) {
                SettingsCheckbox(title: l10n["voice_light_box"], isOn: $voiceLight)
                SettingsSlider(value: Binding(
                    get: { ClotchPrefs.strength(voiceLightStrength) },
                    set: { voiceLightStrength = ClotchPrefs.strength($0) }
                ), range: ClotchPrefs.voiceLightStrengthRange, step: 0.05,
                   ticks: [percent(ClotchPrefs.voiceLightStrengthRange.lowerBound), percent(ClotchPrefs.voiceLightStrengthRange.upperBound)],
                   shown: percent(ClotchPrefs.strength(voiceLightStrength)), label: l10n["voice_light_strength"])
                .disabled(!voiceLight)
            }
        }
        .sheet(isPresented: $customizing) { NotchCustomizeView(screenSignature: screen, onDone: { customizing = false }) }
    }

    private func msRow(_ title: String, _ ms: Binding<Int>) -> some View {
        SettingsRow(title) {
            SettingsSlider(value: Binding(get: { Double(NotchTiming.clamped(ms.wrappedValue)) },
                                          set: { ms.wrappedValue = NotchTiming.clamped(Int($0)) }),
                           range: Double(NotchTiming.range.lowerBound)...Double(NotchTiming.range.upperBound),
                           step: Double(NotchTiming.step),
                           ticks: ["\(NotchTiming.range.lowerBound) ms", "\(NotchTiming.range.upperBound) ms"],
                           shown: "\(NotchTiming.clamped(ms.wrappedValue)) ms", label: title)
        }
    }

    private func seconds(_ v: Double) -> String { settingsDecimal(v) + " s" }
    private func percent(_ v: Double) -> String { "\(Int((v * 100).rounded()))%" }

    private func edit(_ change: (inout NotchScreenLayout) -> Void) {
        var s = store
        var l = layout
        change(&l)
        s.screens[screen] = l
        s.save()
    }
}
