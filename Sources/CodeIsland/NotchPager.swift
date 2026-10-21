import AppKit
import SwiftUI
import CodeIslandCore

/// Pages side by side, moved as on Apple's pagers (#52). On the trackpad the pages follow the fingers 1:1,
/// with a rubber band past the first and last page; on release they settle on the page distance and speed
/// point to (`PageDrag`) with a spring that keeps the gesture's speed. The mouse wheel (one step per spin,
/// `PageSwipe`), the ‹ › buttons and the dots move with the same spring: the next page comes in while the
/// other leaves. Reduce Motion: a short fade.
struct Pager<Page: View, Footer: View>: View {
    let count: Int
    @Binding var index: Int
    /// Who a page is: a page keeps its identity (and what is open on it) when others arrive before it (#36).
    var pageID: (Int) -> String = { String($0) }
    @ViewBuilder let page: (Int) -> Page
    /// Gets `go`, so the page buttons step like a swipe.
    @ViewBuilder let footer: (_ go: @escaping (Int) -> Void) -> Footer
    /// The pages' shift from their rest place, in points (negative = toward the next page).
    @State private var offset: CGFloat = 0
    @State private var width: CGFloat = 0
    @State private var drag: PageDrag?
    /// The trackpad gesture's axis, fixed by its first move: sideways moves the pages, else it passes through.
    @State private var sideways: Bool?
    /// Pages still drawn while a move settles, so none pops out mid-way.
    @State private var keep: ClosedRange<Int>?
    @State private var moves = 0
    @State private var swipe = PageSwipe()
    @State private var monitor: Any?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// From one page to the next, with the gap between them.
    private var pitch: CGFloat { width + NotchSpace.side }

    var body: some View {
        VStack(spacing: NotchSpace.section) {
            ZStack(alignment: .top) {
                if reduceMotion {
                    page(index).id(pageID(index)).transition(.opacity)
                } else {
                    ForEach(drawn, id: \.0) { item in
                        let i = item.1
                        page(i)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .topLeading)
                            .frame(height: i == index ? nil : 0, alignment: .top)  // only the page shown sizes the pager
                            .offset(x: CGFloat(i - index) * pitch + offset)
                            .allowsHitTesting(i == index)
                            .accessibilityHidden(i != index)
                            .transition(.identity)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .top)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
            .clipped()
            footer(go)
                .environment(\.pageProgress, Double(index) - (pitch > 0 ? Double(offset / pitch) : 0))
        }
        .onAppear { startSwipes() }
        .onDisappear { stopSwipes() }
        .accessibilityAdjustableAction { direction in
            go(direction == .increment ? index + 1 : index - 1)
        }
    }

    /// The page shown and its neighbours, plus the ones a move in flight still crosses.
    private var drawn: [(String, Int)] {
        var low = index - 1, high = index + 1
        if let keep { low = min(low, keep.lowerBound); high = max(high, keep.upperBound) }
        return (max(low, 0)..<min(high + 1, count)).map { (pageID($0), $0) }
    }

    func go(_ target: Int) {
        guard (0..<count).contains(target), target != index else { return }
        if reduceMotion {
            withAnimation(NotchMotion.still) { index = target }
        } else {
            settle(on: target, velocity: 0)
        }
    }

    /// Moves to `target` from wherever the pages are, carrying `velocity` (points per second).
    private func settle(on target: Int, velocity: Double) {
        let travel = CGFloat(index - target) * pitch - offset
        let low = min(index, target) - 1, high = max(index, target) + 1
        keep = keep.map { min($0.lowerBound, low)...max($0.upperBound, high) } ?? low...high
        moves += 1
        let move = moves
        withAnimation(NotchMotion.page(velocity: PageDrag.springVelocity(velocity, travel: Double(travel)))) {
            if target != index { index = target }
            offset = 0
        } completion: {
            if moves == move { keep = nil }
        }
    }

    /// Scrolls over the open notch page. The monitor lives only while the pager is on screen, so it costs
    /// nothing with the notch closed.
    private func startSwipes() {
        guard monitor == nil else { return }
        monitor = NSEvent.addLocalMonitorForEvents(matching: .scrollWheel) { event in
            // Our app's only panel is the notch; the settings window is a plain titled window.
            guard event.window is NSPanel else { return event }
            let step = swipe.feed(event)  // fed always, so each gesture's start is seen
            let trackpad = !event.phase.isEmpty
            guard trackpad, event.momentumPhase.isEmpty, !reduceMotion else {
                // The wheel, momentum after a swipe, or Reduce Motion: one step per gesture.
                guard !TabBarPointer.inside else { return event }  // over the tab bar, the scroll moves the tab
                if let step { go(index + step) }
                return event.isSideways ? nil : event
            }
            return follow(event) ? nil : event
        }
    }

    /// A trackpad event: the pages follow the fingers. Returns whether the event was ours.
    private func follow(_ event: NSEvent) -> Bool {
        let now = Date(timeIntervalSinceReferenceDate: event.timestamp)
        if event.phase.contains(.began) || event.phase.contains(.mayBegin) {
            sideways = nil
            drag = nil
        }
        if sideways == nil, event.scrollingDeltaX != 0 || event.scrollingDeltaY != 0 {
            sideways = event.isSideways && !TabBarPointer.inside  // over the tab bar, the scroll moves the tab
            if sideways == true {
                drag = PageDrag()
                moves += 1  // a settle in flight is taken over: its pages stay drawn
            }
        }
        guard sideways == true, var d = drag else { return false }
        if event.phase.contains(.ended) || event.phase.contains(.cancelled) {
            drag = nil
            let target = PageDrag.settle(index: index, offset: Double(offset), velocity: d.releaseVelocity(at: now),
                                         width: Double(pitch), count: count)
            settle(on: target, velocity: d.releaseVelocity(at: now))
            return true
        }
        d.move(dx: Double(event.scrollingDeltaX), at: now)
        drag = d
        withAnimation(NotchMotion.follow) {
            offset = CGFloat(PageDrag.offset(travel: d.travel, index: index, count: count, width: Double(pitch)))
        }
        return true
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

private struct PageProgressKey: EnvironmentKey {
    static let defaultValue: Double? = nil
}

extension EnvironmentValues {
    /// Where the pager is, continuously: 1.4 is 40% of the way from page 1 to page 2. Nil outside a pager.
    var pageProgress: Double? {
        get { self[PageProgressKey.self] }
        set { self[PageProgressKey.self] = newValue }
    }
}

/// The page dots (at most 4, sliding with the page) with ‹ › on each side; a button is off on the first or last page.
/// The current dot is long and bright; during a move it shrinks while the next one grows (`pageProgress`).
struct PageControl: View {
    let count: Int
    let index: Int
    let go: (Int) -> Void
    @Environment(\.pageProgress) private var progress

    var body: some View {
        HStack(spacing: 11) {  // button centre 22 pt past the dots
            arrow("chevron.left", to: index - 1, help: "Pagina precedente")
            HStack(spacing: 6) {
                ForEach(PageDots.window(count: count, index: index), id: \.self) { i in
                    let near = max(0, 1 - abs(Double(i) - (progress ?? Double(index))))
                    Capsule()
                        .fill(Color.white.opacity(0.25 + 0.65 * near))
                        .frame(width: 10 + 10 * near, height: 4)
                        .contentShape(Rectangle().inset(by: -4))
                        .onTapGesture { go(i) }
                        .notchHover(small: true)
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
        .buttonStyle(.notchSmall)
        .disabled(!enabled)
        .help(help)
        .accessibilityLabel(help)
    }
}
