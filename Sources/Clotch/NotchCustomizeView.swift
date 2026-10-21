import AppKit
import SwiftUI
import ClotchCore

/// «Personalizza il notch»: elements, screen, position and width, stored per screen (NotchLayoutStore).
struct NotchCustomizeView: View {
    @ObservedObject private var l10n = L10n.shared
    @AppStorage(SettingsKey.displayChoice) private var displayChoice = SettingsDefaults.displayChoice
    @State private var store = NotchLayoutStore.load()
    @State private var screenSignature = NotchCustomizeView.initialSignature()
    @State private var drag: NotchDrag?
    @State private var spots: [NotchSpot: CGRect] = [:]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var onDone: () -> Void = {}
    /// `--gallery`: a still halfway through a drag (#101), drawn by `SettingsSnapshot`.
    var stillDrag = false

    private var screens: [NSScreen] { NSScreen.screens }
    private var hasNotch: Bool {
        screens.first { ScreenDetector.signature(for: $0) == screenSignature }.map(ScreenDetector.screenHasNotch) ?? false
    }
    private var layout: NotchScreenLayout { store.layout(for: screenSignature, hasNotch: hasNotch) }
    private var followsMouse: Bool { displayChoice == ScreenDetector.followMouseChoice }
    /// The zones an element can go to, left to right: beside a hardware notch the centre is the gap.
    private var zones: [NotchZone] { hasNotch ? [.left, .right] : [.left, .centre, .right] }

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
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 3, coordinateSpace: .named(NotchDrag.space))
                .onChanged { move(from: $0.startLocation, to: $0.location) }.onEnded { _ in dragEnded() })
            Spacer(minLength: 0)
            Divider()
            controls.padding(.horizontal, 24).padding(.vertical, 14)
        }
        .frame(width: 780, height: 560)
        .overlay {
            if let drag { NotchDragPreview(drag: drag).transition(.scale(scale: 0.6).combined(with: .opacity)) }
        }
        .coordinateSpace(name: NotchDrag.space)
        .onPreferenceChange(NotchSpotKey.self) { value in
            MainActor.assumeIsolated {  // SwiftUI delivers preferences on the main thread
                spots = value
                if stillDrag && drag == nil { carryForStill() }
            }
        }
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
        // The dragged element leaves its zone (a palette tile over nothing leaves the notch as it was);
        // a gap (nil) its size opens where it would land.
        let carried = drag.flatMap { drag -> NotchElement? in drag.origin == .cancel && drag.target == .cancel ? nil : drag.element }
        var cells: [NotchElement?] = layout.elements(in: zone).filter { $0 != carried }
        let landing = drag.flatMap { drag -> Int? in
            guard case let .slot(at, index) = drag.target, zones[at] == zone else { return nil }
            return index
        }
        if let landing { cells.insert(nil, at: min(landing, cells.count)) }
        return HStack(spacing: 6) {
            ForEach(cells, id: \.self) { cell in
                if let cell {
                    NotchElementSample(element: cell).spot(.item(cell))
                } else if let drag {
                    NotchDropGap(size: drag.size)
                }
            }
        }
        .frame(maxWidth: .infinity, minHeight: 40)
        .overlay(
            Capsule().strokeBorder(.white.opacity(landing == nil ? 0.35 : 0.8), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
        )
        .spot(.zone(zone))
        .animation(reduceMotion ? nil : NotchMotion.spring, value: landing)
    }

    // MARK: Palette

    private var palette: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(l10n["customize_notch_hint"]).foregroundStyle(.secondary)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 3), spacing: 12) {
                ForEach(NotchElement.allCases, id: \.self) { element in
                    VStack(spacing: 12) {
                        NotchElementSample(element: element).spot(.sample(element))
                        Text(l10n["notch_el_\(element.rawValue)"])
                    }
                    .frame(maxWidth: .infinity, minHeight: 84)
                    .background(RoundedRectangle(cornerRadius: 10).fill(.white.opacity(0.06)))
                    .opacity(layout.contains(element) || drag?.element == element ? 0.45 : 1)
                    .spot(.tile(element))
                }
            }
        }
        .background(RoundedRectangle(cornerRadius: 12).fill(.white.opacity(drag?.target == .remove ? 0.08 : 0)).padding(-8))
        .spot(.palette)
    }

    // MARK: Drag (#101)

    private func move(from start: CGPoint, to point: CGPoint) {
        if drag == nil {
            guard let picked = pick(at: start) else { return }
            let home = picked.frame
            let origin = target(for: picked.element, at: start, fromPalette: picked.fromPalette)
            drag = NotchDrag(element: picked.element, size: home.size, grab: CGSize(width: start.x - home.midX, height: start.y - home.midY),
                             home: home, origin: origin, point: point, target: origin)
        }
        guard var moved = drag, !moved.settling else { return }
        moved.point = point
        moved.target = target(for: moved.element, at: point, fromPalette: moved.origin == .cancel)
        drag = moved
    }

    /// The still: the last element on the right carried into the left zone, held a little above it.
    private func carryForStill() {
        guard let element = layout.elements(in: .right).last ?? layout.elements(in: .left).first,
              let from = spots[.item(element)], let left = spots[.zone(.left)] else { return }
        move(from: CGPoint(x: from.midX, y: from.midY), to: CGPoint(x: left.maxX - 30, y: left.midY - 8))
    }

    /// The element under `point`: one in a zone, or a palette tile (its sample is what lifts).
    private func pick(at point: CGPoint) -> (element: NotchElement, frame: CGRect, fromPalette: Bool)? {
        for element in NotchElement.allCases {
            if let frame = spots[.item(element)], frame.contains(point) { return (element, frame, false) }
            if spots[.tile(element)]?.contains(point) == true, let sample = spots[.sample(element)] { return (element, sample, true) }
        }
        return nil
    }

    /// A tile dropped back on the palette changes nothing, so from the palette it is not a drop target.
    private func target(for element: NotchElement, at point: CGPoint, fromPalette: Bool) -> NotchDrop {
        let measured = zones.map { zone in
            (frame: spots[.zone(zone)] ?? .zero,
             items: layout.elements(in: zone).filter { $0 != element }.compactMap { spots[.item($0)] })
        }
        return NotchReorder.drop(at: point, zones: measured, palette: fromPalette ? nil : spots[.palette])
    }

    /// Lands where the gap is (or flies home on a cancel), then saves with nothing left to move.
    private func dragEnded() {
        guard var released = drag, !released.settling else { return }
        let place: CGRect?
        switch released.target {
        case .remove: place = nil
        case .cancel: place = released.home; released.target = released.origin  // the gap reopens at home
        case .slot: place = spots[.gap] ?? released.home
        }
        let commit = {
            var still = Transaction()
            still.disablesAnimations = true
            withTransaction(still) { apply(released); drag = nil }
        }
        guard let place, !reduceMotion else {
            withAnimation(reduceMotion ? nil : NotchMotion.spring) { apply(released); drag = nil }
            return
        }
        released.land(on: place)
        withAnimation(NotchMotion.spring, completionCriteria: .logicallyComplete) { drag = released } completion: { commit() }
    }

    private func apply(_ drag: NotchDrag) {
        switch drag.target {
        case let .slot(zone, index): edit { $0.place(drag.element, in: zones[zone], at: index, hasNotch: hasNotch) }
        case .remove: edit { $0.remove(drag.element); return true }
        case .cancel: break
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
                Text(l10n["notch_show"]).foregroundStyle(.secondary)
                Picker("", selection: Binding(
                    get: { layout.iconsOnly == true },
                    set: { value in edit { $0.iconsOnly = value; return true } }
                )) {
                    Text(l10n["notch_show_text"]).tag(false)
                    Text(l10n["notch_show_icons"]).tag(true)
                }
                .pickerStyle(.segmented).labelsHidden().frame(width: 230)
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

    func applyAppearance() {
        window?.appearance = AppearanceChoice.read().nsAppearance
    }

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
        window.appearance = AppearanceChoice.read().nsAppearance
        window.contentView = NSHostingView(rootView: NotchCustomizeView(onDone: { [weak self] in self?.window?.close() }))
        window.isReleasedWhenClosed = false
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        self.window = window
    }
}
