import AppKit
import SwiftUI
import CodeIslandCore

// The «Obiettivi» tab of the open notch (Figma 4-2281): one goal per page, the goal chased now first.
// Copy is plain Italian literals (app-copy). Black like the hardware notch.
// Zero idle cost: the only clock is the work-time counter of the page on screen while its goal moves,
// and the scroll monitor lives only while the view is on screen, so a closed notch runs neither.

extension NotchAnimation {
    /// The one spring of the goals tab: a page step, the dim and the ring all share it. Fast, no overshoot.
    static var page: Animation {
        .spring(response: NotchAnimationMetrics.closeResponse * 0.8, dampingFraction: 1)
    }
}

/// The tab, wired to the live goals.
struct GoalsTab: View {
    @ObservedObject private var store = GoalStore.shared

    var body: some View { GoalsTabView(rows: store.rows) }
}

/// `slot` draws under each goal: the pull-request rows (GoalPRRow) plug in there.
struct GoalsTabView<Slot: View>: View {
    let rows: [GoalRow]
    private let slot: (GoalRow) -> Slot

    init(rows: [GoalRow], @ViewBuilder slot: @escaping (GoalRow) -> Slot) {
        self.rows = rows
        self.slot = slot
    }

    @State private var pageId: String?
    @State private var width: CGFloat = 0
    @State private var dimmed = false
    @State private var dimStamp = 0
    @State private var swipe = GoalSwipe()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.notchSnapshot) private var snapshot

    private var goals: [GoalRow] { GoalPager.ordered(rows) }
    /// By goal id, so a reorder of the board never moves the page under the reader's eyes.
    private var pager: GoalPager {
        GoalPager(count: goals.count, page: goals.firstIndex { $0.id == pageId } ?? 0)
    }

    var body: some View {
        let current = pager
        VStack(spacing: 12) {
            if goals.isEmpty {
                EmptyState(text: "Nessun obiettivo aperto").frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 12)
            } else {
                pages(current)
                if goals.count > 1 { controls(current) }
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 14)
        .frame(maxWidth: .infinity)
        .background(.black)
        .background {
            // ImageRenderer cannot draw an NSView: the snapshot skips it.
            if !snapshot {
                SwipeCatcher { dx, dy, ended, momentum, precise, time in
                    let r = swipe.feed(dx: dx, dy: dy, ended: ended, momentum: momentum, precise: precise, time: time)
                    if r.step != 0 { go(r.step) }
                    return r.consumed
                }
            }
        }
    }

    // MARK: pages

    private func pages(_ pager: GoalPager) -> some View {
        // All pages stack in one cell (so every page is as tall as the tallest) and slide by one width each.
        // Until the width is measured (and in ImageRenderer, which never measures) only the current page shows.
        ZStack(alignment: .topLeading) {
            ForEach(Array(goals.enumerated()), id: \.element.id) { i, row in
                GoalPage(row: row, index: i + 1, count: goals.count, active: i == pager.page, slot: slot)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .offset(x: CGFloat(i - pager.page) * width)
                    .opacity(i == pager.page || width > 0 ? 1 : 0)
            }
        }
        .opacity(dimmed ? 0.4 : 1)
        .blur(radius: dimmed && !reduceMotion ? 3 : 0)
        .animation(reduceMotion ? nil : NotchAnimation.page, value: pager.page)
        .animation(reduceMotion ? nil : NotchAnimation.page, value: dimmed)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .clipped()
        .task(id: dimStamp) {
            guard dimStamp > 0 else { return }
            try? await Task.sleep(for: .milliseconds(380))
            if !Task.isCancelled { dimmed = false }
        }
    }

    /// ‹ dots › : both buttons stay in place and turn off at the first and last page.
    private func controls(_ pager: GoalPager) -> some View {
        HStack(spacing: 10) {
            StepButton(symbol: "chevron.left", label: "Mostra obiettivo precedente", enabled: pager.canBack) { go(-1) }
            HStack(spacing: 6) {
                ForEach(0..<pager.count, id: \.self) { i in
                    Capsule().fill(i == pager.page ? GoalInk.primary : GoalInk.track).frame(width: 20, height: 4)
                }
            }
            StepButton(symbol: "chevron.right", label: "Mostra obiettivo successivo", enabled: pager.canForward) { go(1) }
        }
        .animation(reduceMotion ? nil : NotchAnimation.page, value: pager.page)
        .accessibilityElement(children: .contain)
    }

    /// One page per call, the edge stops it; the content dims until the page has settled.
    private func go(_ delta: Int) {
        var p = pager
        guard p.step(delta) else { return }
        pageId = goals[p.page].id
        dimmed = true
        dimStamp += 1
    }
}

extension GoalsTabView where Slot == EmptyView {
    init(rows: [GoalRow]) { self.init(rows: rows) { _ in EmptyView() } }
}

// MARK: - One goal

private struct GoalPage<Slot: View>: View {
    let row: GoalRow
    let index: Int
    let count: Int
    let active: Bool
    let slot: (GoalRow) -> Slot

    private var link: URL? {
        row.pulses.first { $0.kind == .master }.flatMap { ClaudeDesktopCodeSession.deepLinkURL(hostSessionId: $0.id) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label("Obiettivo \(index) di \(count)", systemImage: "scope").font(NotchType.secondary).foregroundStyle(GoalInk.secondary)
                Spacer(minLength: 8)
                Text(row.stateLabel)
                    .font(NotchType.label)
                    .foregroundStyle(row.ink)
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(row.ink.opacity(0.16), in: Capsule())
            }
            HStack(alignment: .center, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    title
                    if row.hasSubtitle {
                        Text(row.goal).font(.system(size: 13)).foregroundStyle(GoalInk.secondary).lineLimit(2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if row.proofsTotal > 0 { ProofRing(row: row) }
            }
            HStack(spacing: 16) {
                SessionsWorking(row: row)
                WorkTime(row: row, active: active)
                Spacer(minLength: 8)
                Text(row.reason(now: Date()) ?? row.proofsSentence)
                    .font(NotchType.bodyEmphasis).foregroundStyle(row.ink).lineLimit(1).truncationMode(.tail)
            }
            Rectangle().fill(Color.white.opacity(0.1)).frame(height: 0.5)
            slot(row)  // the pull requests of this goal
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(row.accessibilityText(now: Date()))
        .accessibilityHidden(!active)
    }

    /// The name is the link to the master session; without a live master there is nothing to open.
    @ViewBuilder private var title: some View {
        let text = HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(row.title).font(.system(size: 22, weight: .bold)).foregroundStyle(GoalInk.primary).lineLimit(2)
            if link != nil { Image(systemName: "arrow.up.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(GoalInk.secondary) }
        }
        if let link {
            Button { NSWorkspace.shared.open(link) } label: { text }
                .buttonStyle(.plain)
                .help("Apri sessione")
                .accessibilityHint("Apre la sessione master")
        } else {
            text
        }
    }
}

extension GoalRow {
    /// A state label: adjective or participle, never a sentence.
    var stateLabel: String {
        if proposed { return "Proposto" }
        switch status {
        case .moving: return "In corso"
        case .still: return "Fermo"
        case .blocked: return "Bloccato"
        case .reached: return "Raggiunto"
        }
    }

    var proofsSentence: String { proofsTotal > 0 ? "\(proofsDone) prove su \(proofsTotal)" : "Nessuna prova dichiarata" }
    var isMoving: Bool { if case .moving = status { return !proposed } else { return false } }
}

/// The progress ring: proofs done over declared proofs, in the state colour. Only goals with proofs get one.
private struct ProofRing: View {
    let row: GoalRow
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Circle().stroke(GoalInk.track, lineWidth: 7)
            Circle()
                .trim(from: 0, to: CGFloat(min(row.progress ?? 0, 1)))
                .stroke(row.ink, style: StrokeStyle(lineWidth: 7, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(row.proofsDone)/\(row.proofsTotal)").font(NotchType.figure).foregroundStyle(GoalInk.primary)
                Text("prove").font(NotchType.caption).foregroundStyle(GoalInk.secondary)
            }
        }
        .frame(width: 96, height: 96)
        .animation(reduceMotion ? nil : NotchAnimation.page, value: row.progress)
    }
}

private struct SessionsWorking: View {
    let row: GoalRow

    var body: some View {
        let n = row.runningCount
        Label(n == 0 ? "Nessuna sessione al lavoro" : "\(n) \(n == 1 ? "sessione" : "sessioni") al lavoro", systemImage: "terminal")
            .font(NotchType.secondary)
            .foregroundStyle(n > 0 ? GoalInk.primary : GoalInk.secondary)
    }
}

/// Time worked on the goal. It runs (one tick a second) only for the page on screen while the goal
/// moves; otherwise it shows the figure at the last activity and nothing wakes.
struct WorkTime: View {
    let row: GoalRow
    let active: Bool

    var body: some View {
        if let start = row.workStart {
            Label { clock(start: start) } icon: { Image(systemName: "stopwatch") }
                .font(NotchType.bodyEmphasis)
                .foregroundStyle(GoalInk.primary)
                .accessibilityLabel("Tempo di lavoro")
        }
    }

    @ViewBuilder private func clock(start: Date) -> some View {
        if active && row.isMoving {
            TimelineView(.periodic(from: .now, by: 1)) { ctx in text(from: start, to: ctx.date) }
        } else {
            text(from: start, to: row.lastActivity ?? start)
        }
    }

    private func text(from start: Date, to end: Date) -> some View {
        Text(Self.format(end.timeIntervalSince(start))).monospacedDigit()
    }

    /// h:mm:ss; never negative.
    static func format(_ seconds: TimeInterval) -> String {
        let s = max(Int(seconds), 0)
        return String(format: "%d:%02d:%02d", s / 3600, s / 60 % 60, s % 60)
    }
}

private struct StepButton: View {
    let symbol: String
    let label: String
    let enabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(GoalInk.primary)
                .frame(width: 22, height: 22)
                .background(Color.white.opacity(0.1), in: Circle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.3)
        .help(label)
        .accessibilityLabel(label)
    }
}

// MARK: - Horizontal scroll

/// Sees horizontal scrolls over the tab (trackpad swipes and mouse wheel) without covering it, so
/// buttons and links keep their clicks. A local monitor exists only while the view is in a window.
private struct SwipeCatcher: NSViewRepresentable {
    /// dx, dy, ended, momentum, precise, time -> true when the event belongs to the swipe.
    let onScroll: (CGFloat, CGFloat, Bool, Bool, Bool, TimeInterval) -> Bool

    func makeNSView(context: Context) -> CatcherView { CatcherView() }
    func updateNSView(_ view: CatcherView, context: Context) { view.onScroll = onScroll }

    final class CatcherView: NSView {
        var onScroll: ((CGFloat, CGFloat, Bool, Bool, Bool, TimeInterval) -> Bool)?
        private var monitor: Any?

        override func viewDidMoveToWindow() {
            if let monitor { NSEvent.removeMonitor(monitor) }
            monitor = nil
            guard window != nil else { return }
            monitor = NSEvent.addLocalMonitorForEvents(matching: .scrollWheel) { [weak self] event in
                guard let self, event.window === self.window,
                      self.bounds.contains(self.convert(event.locationInWindow, from: nil)) else { return event }
                let ended = event.phase == .ended || event.phase == .cancelled
                let consumed = self.onScroll?(event.scrollingDeltaX, event.scrollingDeltaY, ended,
                                              !event.momentumPhase.isEmpty, event.hasPreciseScrollingDeltas, event.timestamp)
                return consumed == true ? nil : event
            }
        }
    }
}
