import AppKit
import SwiftUI

/// «Personalizza il notch» (Figma #95): a sheet over the Notch page. The elements of one screen's closed notch, dragged in
/// and out, or the standard set; stored per screen (NotchLayoutStore). Screen and width are on the Notch page.
struct NotchCustomizeView: View {
    @ObservedObject private var l10n = L10n.shared
    @State private var store = NotchLayoutStore.load()
    var screenSignature = NotchCustomizeView.initialSignature()
    var onDone: () -> Void = {}

    private var hasNotch: Bool { Self.hasNotch(screenSignature) }
    private var layout: NotchScreenLayout { store.layout(for: screenSignature, hasNotch: hasNotch) }

    /// The screen the notch is on now: the one the settings open on.
    static func initialSignature() -> String {
        let choice = UserDefaults.standard.string(forKey: SettingsKey.displayChoice) ?? SettingsDefaults.displayChoice
        let screens = NSScreen.screens
        let index = ScreenDetector.selectedIndex(choice: choice, frames: screens.map(\.frame), mouse: NSEvent.mouseLocation)
        return ScreenDetector.signature(for: index.map { screens[$0] } ?? NSScreen.main ?? screens[0])
    }

    static func hasNotch(_ signature: String) -> Bool {
        NSScreen.screens.first { ScreenDetector.signature(for: $0) == signature }.map(ScreenDetector.screenHasNotch) ?? false
    }

    static func name(of screen: NSScreen) -> String {
        String(format: L10n.shared[ScreenDetector.screenHasNotch(screen) ? "notch_screen_with" : "notch_screen_without"], screen.localizedName)
    }

    /// The closed notch of the screen it is on now, for the previews.
    static func currentLayout() -> NotchScreenLayout {
        let sig = initialSignature()
        return NotchLayoutStore.load().layout(for: sig, hasNotch: hasNotch(sig))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            menuBar
            Text(l10n["customize_notch_hint"]).fontWeight(.medium)
            palette
            Divider()
            Text(l10n["customize_notch_standard"]).fontWeight(.medium)
            ClosedNotchPreview(layout: .standard(hasNotch: hasNotch))
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                .draggable(Self.standardDrag)
            SettingsNote(l10n["notch_centre_hint"])
            HStack(spacing: 8) {
                Text(l10n["notch_show"])
                Picker(l10n["notch_show"], selection: Binding(
                    get: { layout.iconsOnly == true },
                    set: { value in edit { $0.iconsOnly = value; return true } }
                )) {
                    Text(l10n["notch_show_text"]).tag(false)
                    Text(l10n["notch_show_icons"]).tag(true)
                }
                .labelsHidden().frame(width: 150)
                Spacer()
                Button(l10n["notch_done"], action: onDone).keyboardShortcut(.defaultAction)
            }
        }
        .padding(EdgeInsets(top: 24, leading: 32, bottom: 26, trailing: 32))
        .frame(width: ClotchSettingsWindow.width)
        .fixedSize(horizontal: false, vertical: true)
    }

    private static let standardDrag = "standard"

    // MARK: Menu bar with the notch, the drop target

    private var menuBar: some View {
        ZStack(alignment: .top) {
            HStack(spacing: 14) {
                Text("Finder").fontWeight(.semibold)
                Text("File")
                Text(l10n["menu_view"])
                Spacer()
                Text(Date.now.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).hour().minute()))
            }
            .font(.system(size: 11))
            .padding(.horizontal, 12)
            .frame(height: 26)
            .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.primary.opacity(0.06)))
            notch
        }
        .frame(height: 38, alignment: .top)
    }

    private var notch: some View {
        HStack(spacing: 6) {
            zone(.left)
            if hasNotch { Color.clear.frame(width: 24, height: 1) } else { zone(.centre) }
            zone(.right)
        }
        .padding(.horizontal, 12)
        .frame(minWidth: 250, minHeight: 38)
        .background(UnevenRoundedRectangle(bottomLeadingRadius: 10, bottomTrailingRadius: 10, style: .continuous).fill(.black))
        .dropDestination(for: String.self) { items, _ in
            guard items.first == Self.standardDrag else { return false }
            return edit { $0 = .standard(hasNotch: hasNotch); return true }
        }
    }

    private func zone(_ zone: NotchZone) -> some View {
        HStack(spacing: 6) {
            ForEach(layout.elements(in: zone), id: \.self) { element in
                NotchElementSample(element: element, chip: false).draggable(element.rawValue)
            }
        }
        .frame(minWidth: 24, minHeight: 24)
        .contentShape(Rectangle())
        .dropDestination(for: String.self) { items, _ in
            guard let element = items.first.flatMap(NotchElement.init(rawValue:)) else { return false }
            return edit { $0.place(element, in: zone, hasNotch: hasNotch) }
        }
    }

    // MARK: Palette

    /// The palette's order, as the design: notch elements first, then the accounts and sessions.
    private static let paletteOrder: [NotchElement] = [.goalRings, .activeGoal, .pendingRequests, .accounts, .accountsWide, .workingSessions]

    private var palette: some View {
        Grid(horizontalSpacing: 12, verticalSpacing: 16) {
            ForEach(Array(stride(from: 0, to: Self.paletteOrder.count, by: 3)), id: \.self) { start in
                GridRow {
                    ForEach(Self.paletteOrder[start..<min(start + 3, Self.paletteOrder.count)], id: \.self) { element in
                        VStack(spacing: 6) {
                            NotchElementSample(element: element).fixedSize()
                            Text(l10n["notch_el_\(element.rawValue)"]).font(.system(size: 11))
                        }
                        .frame(maxWidth: .infinity)
                        .opacity(layout.contains(element) ? 0.45 : 1)
                        .draggable(element.rawValue)
                    }
                }
            }
        }
        // Dropping an element back on the palette removes it from the notch.
        .dropDestination(for: String.self) { items, _ in
            guard let element = items.first.flatMap(NotchElement.init(rawValue:)) else { return false }
            return edit { $0.remove(element); return true }
        }
    }

    /// Applies `change` to this screen's layout and saves; false (a refused drop) saves nothing.
    @discardableResult
    private func edit(_ change: (inout NotchScreenLayout) -> Bool) -> Bool {
        var updated = layout
        guard change(&updated) else { return false }
        store = NotchLayoutStore.load()  // the Notch page may have changed the width since the sheet opened
        store.screens[screenSignature] = updated
        store.save()
        return true
    }
}

/// The old settings window's entry point (SettingsView): the same view in its own window.
@MainActor
final class NotchCustomizeWindowController {
    static let shared = NotchCustomizeWindowController()
    private var window: NSWindow?

    func applyAppearance() {
        window?.appearance = AppearanceChoice.read().nsAppearance
    }

    func show() {
        window?.close()
        let window = NSWindow(contentRect: .zero, styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = L10n.shared["customize_notch"]
        window.appearance = AppearanceChoice.read().nsAppearance
        window.contentView = NSHostingView(rootView: NotchCustomizeView(onDone: { [weak window] in window?.close() }))
        window.isReleasedWhenClosed = false
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        self.window = window
    }
}
