import AppKit
import SwiftUI
import ClotchCore

/// Pages side by side, moved as on Apple's pagers (#52). On the trackpad the pages follow the fingers 1:1,
/// with a rubber band past the first and last page; on release they settle on the page distance and speed
/// point to (`PageDrag`) with a spring that keeps the gesture's speed. The mouse wheel (one step per spin,
/// `PageSwipe`), the ‹ › buttons move with the same spring: the next page comes in while the
/// other leaves. The spring is `PageSpring`, run here tick by tick, so `offset` is always where the pages
/// really are: any new gesture, of any kind, takes them from there, with their speed (#119).
/// Reduce Motion: a short fade.
struct Pager<Page: View, Footer: View>: View {
    let count: Int
    @Binding var index: Int
    /// Who a page is: a page keeps its identity (and what is open on it) when others arrive before it (#36).
    var pageID: (Int) -> String = { String($0) }
    /// Something over the pages that steps like a swipe (the goals' name strip); nil = nothing.
    var above: ((_ go: @escaping (Int) -> Void) -> AnyView)? = nil
    @ViewBuilder let page: (Int) -> Page
    /// Gets `go`, so the page buttons step like a swipe.
    @ViewBuilder let footer: (_ go: @escaping (Int) -> Void) -> Footer
    /// The pages' shift from their rest place, in points (negative = toward the next page).
    @State private var offset: CGFloat = 0
    @State private var spring = PageSpring()
    @State private var ticker: Timer?
    @State private var tickedAt = Date()
    @State private var width: CGFloat = 0
    @State private var drag: PageDrag?
    /// The trackpad gesture's axis, fixed by its first move: sideways moves the pages, else it passes through.
    @State private var sideways: Bool?
    /// Pages still drawn while a move settles, so none pops out mid-way.
    @State private var keep: ClosedRange<Int>?
    @State private var swipe = PageSwipe()
    @State private var monitor: Any?
    /// Where the scroll monitor goes: the newest copy of this view (see `Live`).
    @State private var live = Live()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// From one page to the next, with the gap between them.
    private var pitch: CGFloat { width + NotchSpace.side }

    var body: some View {
        let _ = connect()  // every update: the monitor never works from old values
        VStack(spacing: NotchSpace.section) {
            if let above { above(go) }
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
            settle(on: target, fingers: nil)
        }
    }

    /// Moves to `target` from wherever the pages are. `index` and `offset` trade one pitch per page, so
    /// nothing jumps on screen (the animation is only for the notch's height); then the spring runs from
    /// there, with the speed of the fingers that let go, or else the one it already had.
    private func settle(on target: Int, fingers: Double?) {
        let from = Double(offset) + Double(index - target) * Double(pitch)
        let speed = fingers.map { PageDrag.springVelocity($0, travel: -from) * -from } ?? spring.velocity
        let low = min(index, target) - 1, high = max(index, target) + 1
        keep = keep.map { min($0.lowerBound, low)...max($0.upperBound, high) } ?? low...high
        withAnimation(NotchMotion.spring) {
            index = target
            offset = CGFloat(from)
        }
        spring = PageSpring(offset: from, velocity: speed)
        ticker?.invalidate()
        tickedAt = Date()
        let timer = Timer(timeInterval: 1.0 / 120, repeats: true) { timer in
            let now = Date()
            spring.advance(by: now.timeIntervalSince(tickedAt))
            tickedAt = now
            offset = CGFloat(spring.offset)
            if spring.isAtRest { timer.invalidate(); keep = nil }
        }
        RunLoop.main.add(timer, forMode: .common)
        ticker = timer
    }

    /// A gesture takes the pages where they are: the spring stops, `offset` stays.
    private func grab() {
        ticker?.invalidate()
        spring = PageSpring()
    }

    /// A copy of the pager made when the monitor was installed keeps that moment's `count`, `index` and
    /// `pageID` for good: with pages that arrive later (the goals), it could never reach them (#119). So the
    /// monitor calls this box, and every update of the view puts its own `scroll` in it.
    private final class Live { var handle: ((NSEvent) -> NSEvent?)? }

    /// Scrolls over the open notch page. The monitor lives only while the pager is on screen, so it costs
    /// nothing with the notch closed.
    private func startSwipes() {
        guard monitor == nil else { return }
        connect()
        let live = live
        monitor = NSEvent.addLocalMonitorForEvents(matching: .scrollWheel) { event in live.handle?(event) ?? event }
    }

    private func connect() { live.handle = { event in scroll(event) } }

    private func scroll(_ event: NSEvent) -> NSEvent? {
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
                grab()  // a settle in flight is taken over: its pages stay drawn
                drag = PageDrag(travel: Double(offset))
            }
        }
        guard sideways == true, var d = drag else { return false }
        if event.phase.contains(.ended) || event.phase.contains(.cancelled) {
            drag = nil
            let target = PageDrag.settle(index: index, offset: Double(offset), velocity: d.releaseVelocity(at: now),
                                         width: Double(pitch), count: count)
            settle(on: target, fingers: d.releaseVelocity(at: now))
            return true
        }
        d.move(dx: Double(event.scrollingDeltaX), at: now)
        drag = d
        offset = CGFloat(PageDrag.offset(travel: d.travel, index: index, count: count, width: Double(pitch)))
        return true
    }

    private func stopSwipes() {
        if let monitor { NSEvent.removeMonitor(monitor) }
        monitor = nil
        live.handle = nil  // it holds a copy of this view, which holds this box
        ticker?.invalidate()
        ticker = nil
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

/// The ‹ › buttons under the pages; a button is off on the first or last page. No dots (clotch#114: the pager has none).
struct PageControl: View {
    let count: Int
    let index: Int
    let go: (Int) -> Void

    var body: some View {
        HStack(spacing: 8) {
            arrow("chevron.left", to: index - 1, help: "Pagina precedente")
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
