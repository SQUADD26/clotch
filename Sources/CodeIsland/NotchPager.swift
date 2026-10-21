import AppKit
import SwiftUI
import CodeIslandCore

/// Pages side by side: one step per swipe (`PageSwipe`), the ‹ › buttons or the dots. While a page
/// slides in, both pages are dimmed, so nothing is read half-way. One spring; Reduce Motion fades.
struct Pager<Page: View, Footer: View>: View {
    let count: Int
    @Binding var index: Int
    @ViewBuilder let page: (Int) -> Page
    /// Gets `go`, so the page buttons step like a swipe.
    @ViewBuilder let footer: (_ go: @escaping (Int) -> Void) -> Footer
    @State private var forward = true
    @State private var moving = false
    @State private var swipe = PageSwipe()
    @State private var monitor: Any?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: NotchSpace.section) {
            ZStack(alignment: .top) {
                page(index)
                    .id(index)
                    .transition(reduceMotion ? .opacity : .push(from: forward ? .trailing : .leading))
            }
            .opacity(moving ? 0.45 : 1)  // Figma: 35% leaving, 55% arriving
            .blur(radius: moving && !reduceMotion ? 2.5 : 0)
            .frame(maxWidth: .infinity, alignment: .top)
            .clipped()
            footer(go)
        }
        .onAppear { startSwipes() }
        .onDisappear { stopSwipes() }
        .accessibilityAdjustableAction { direction in
            go(direction == .increment ? index + 1 : index - 1)
        }
    }

    func go(_ target: Int) {
        guard (0..<count).contains(target), target != index else { return }
        forward = target > index
        moving = true
        withAnimation(NotchMotion.animation(reduce: reduceMotion)) {
            index = target
        } completion: {
            withAnimation(NotchMotion.still) { moving = false }
        }
    }

    /// Horizontal scrolls over the open notch page; vertical ones pass through. The monitor lives only
    /// while the pager is on screen, so it costs nothing with the notch closed.
    private func startSwipes() {
        guard monitor == nil else { return }
        monitor = NSEvent.addLocalMonitorForEvents(matching: .scrollWheel) { event in
            // Our app's only panel is the notch; the settings window is a plain titled window.
            guard event.window is NSPanel else { return event }
            let step = swipe.feed(event)
            guard !TabBarPointer.inside else { return event }  // over the tab bar, the scroll moves the tab
            if let step { go(index + step) }
            return event.isSideways ? nil : event
        }
    }

    private func stopSwipes() {
        if let monitor { NSEvent.removeMonitor(monitor) }
        monitor = nil
    }
}

extension NSEvent {
    var isSideways: Bool { abs(scrollingDeltaX) > abs(scrollingDeltaY) }
}

extension PageSwipe {
    /// Every gesture start is seen, whatever its axis; only sideways travel counts.
    mutating func feed(_ event: NSEvent) -> Int? {
        let phase: Phase
        if !event.momentumPhase.isEmpty { phase = .momentum }
        else if event.phase.contains(.began) || event.phase.contains(.mayBegin) { phase = .began }
        else if event.phase.contains(.ended) || event.phase.contains(.cancelled) { phase = .ended }
        else if event.phase.isEmpty { phase = .wheel }
        else { phase = .changed }
        return feed(dx: event.isSideways ? Double(event.scrollingDeltaX) : 0, phase: phase, at: Date())
    }
}

/// The page dots (at most 4, sliding with the page) with ‹ › on each side; a button is off on the first or last page.
struct PageControl: View {
    let count: Int
    let index: Int
    let go: (Int) -> Void

    var body: some View {
        HStack(spacing: 11) {  // button centre 22 pt past the dots
            arrow("chevron.left", to: index - 1, help: "Pagina precedente")
            HStack(spacing: 6) {
                ForEach(PageDots.window(count: count, index: index), id: \.self) { i in
                    Capsule()
                        .fill(Color.white.opacity(i == index ? 0.9 : 0.25))
                        .frame(width: 14, height: 4)
                        .contentShape(Rectangle().inset(by: -4))
                        .onTapGesture { go(i) }
                }
            }
            arrow("chevron.right", to: index + 1, help: "Pagina successiva")
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Pagina \(index + 1) di \(count)")
    }

    private func arrow(_ symbol: String, to target: Int, help: String) -> some View {
        let enabled = (0..<count).contains(target)
        return Button { go(target) } label: {
            Image(systemName: symbol)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.white.opacity(enabled ? 0.9 : 0.35))
                .frame(width: 22, height: 22)
                .background(Circle().fill(enabled ? GoalInk.button : GoalInk.buttonOff))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .help(help)
        .accessibilityLabel(help)
    }
}
