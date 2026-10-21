import AppKit
import SwiftUI

/// «Personalizza il notch»: elements, screen, position and width, stored per screen (NotchLayoutStore).
struct NotchCustomizeView: View {
    @ObservedObject private var l10n = L10n.shared
    @AppStorage(SettingsKey.displayChoice) private var displayChoice = SettingsDefaults.displayChoice
    @State private var store = NotchLayoutStore.load()
    @State private var screenSignature = NotchCustomizeView.initialSignature()
    var onDone: () -> Void = {}

    private var screens: [NSScreen] { NSScreen.screens }
    private var hasNotch: Bool {
        screens.first { ScreenDetector.signature(for: $0) == screenSignature }.map(ScreenDetector.screenHasNotch) ?? false
    }
    private var layout: NotchScreenLayout { store.layout(for: screenSignature, hasNotch: hasNotch) }
    private var followsMouse: Bool { displayChoice == ScreenDetector.followMouseChoice }

    private static func initialSignature() -> String {
        let choice = UserDefaults.standard.string(forKey: SettingsKey.displayChoice) ?? SettingsDefaults.displayChoice
        let screens = NSScreen.screens
        let index = ScreenDetector.selectedIndex(choice: choice, frames: screens.map(\.frame), mouse: NSEvent.mouseLocation)
        return ScreenDetector.signature(for: index.map { screens[$0] } ?? NSScreen.main ?? screens[0])
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 22) {
                preview
                palette
            }
            .padding(24)
            Spacer(minLength: 0)
            Divider()
            controls.padding(.horizontal, 24).padding(.vertical, 14)
        }
        .frame(width: 780, height: 560)
    }

    // MARK: Preview

    private var preview: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                zone(.left)
                if hasNotch {
                    Color.clear.frame(width: 90)
                } else {
                    zone(.centre)
                }
                zone(.right)
            }
            .padding(10)
            .background(Capsule().fill(.black))
            Text(l10n["notch_centre_hint"]).font(.caption).foregroundStyle(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 12).fill(.black.opacity(0.35)))
    }

    private func zone(_ zone: NotchZone) -> some View {
        HStack(spacing: 6) {
            ForEach(layout.elements(in: zone), id: \.self) { element in
                NotchElementSample(element: element).draggable(element.rawValue)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 40)
        .overlay(
            Capsule().strokeBorder(.white.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
        )
        .dropDestination(for: String.self) { items, _ in
            guard let element = items.first.flatMap(NotchElement.init(rawValue:)) else { return false }
            return edit { $0.place(element, in: zone, hasNotch: hasNotch) }
        }
    }

    // MARK: Palette

    private var palette: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(l10n["customize_notch_hint"]).foregroundStyle(.secondary)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 3), spacing: 12) {
                ForEach(NotchElement.allCases, id: \.self) { element in
                    VStack(spacing: 12) {
                        NotchElementSample(element: element)
                        Text(l10n["notch_el_\(element.rawValue)"])
                    }
                    .frame(maxWidth: .infinity, minHeight: 84)
                    .background(RoundedRectangle(cornerRadius: 10).fill(.white.opacity(0.06)))
                    .opacity(layout.contains(element) ? 0.45 : 1)
                    .draggable(element.rawValue)
                }
            }
        }
        // Dropping an element back on the palette removes it from the notch.
        .dropDestination(for: String.self) { items, _ in
            guard let element = items.first.flatMap(NotchElement.init(rawValue:)) else { return false }
            return edit { $0.remove(element); return true }
        }
    }

    // MARK: Controls

    private var controls: some View {
        VStack(spacing: 14) {
            HStack(spacing: 16) {
                Text(l10n["display"]).foregroundStyle(.secondary)
                Picker("", selection: $screenSignature) {
                    ForEach(screens, id: \.self) { screen in
                        let name = screen.localizedName
                        Text(String(format: l10n[ScreenDetector.screenHasNotch(screen) ? "notch_screen_with" : "notch_screen_without"], name))
                            .tag(ScreenDetector.signature(for: screen))
                    }
                }
                .labelsHidden().frame(width: 250)
                .onChange(of: screenSignature) { _, new in
                    if !followsMouse { displayChoice = ScreenDetector.fixedPrefix + new }
                }
                Text(l10n["notch_position"]).foregroundStyle(.secondary)
                Picker("", selection: Binding(
                    get: { followsMouse },
                    set: { displayChoice = $0 ? ScreenDetector.followMouseChoice : ScreenDetector.fixedPrefix + screenSignature }
                )) {
                    Text(l10n["notch_position_fixed"]).tag(false)
                    Text(l10n["follow_mouse"]).tag(true)
                }
                .pickerStyle(.segmented).labelsHidden().frame(width: 230)
                Spacer()
                Button(l10n["notch_done"], action: onDone).keyboardShortcut(.defaultAction)
            }
            HStack(spacing: 16) {
                Text(l10n["notch_width"]).foregroundStyle(.secondary)
                Slider(value: Binding(
                    get: { layout.width },
                    set: { value in edit { $0.width = value; return true } }
                ), in: 0...1)
                Text(l10n[layout.widthKey]).foregroundStyle(.secondary).frame(width: 260, alignment: .trailing)
            }
        }
    }

    /// Applies `change` to this screen's layout and saves; false (a refused drop) saves nothing.
    @discardableResult
    private func edit(_ change: (inout NotchScreenLayout) -> Bool) -> Bool {
        var updated = layout
        guard change(&updated) else { return false }
        store.screens[screenSignature] = updated
        store.save()
        return true
    }
}

@MainActor
final class NotchCustomizeWindowController {
    static let shared = NotchCustomizeWindowController()
    private var window: NSWindow?

    func show() {
        if let window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }
        let window = NSWindow(
            contentRect: .zero,
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.title = L10n.shared["customize_notch"]
        window.appearance = NSAppearance(named: .darkAqua)
        window.contentView = NSHostingView(rootView: NotchCustomizeView(onDone: { [weak self] in self?.window?.close() }))
        window.isReleasedWhenClosed = false
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        self.window = window
    }
}
