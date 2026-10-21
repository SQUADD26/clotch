import AppKit
import SwiftUI
import CodeIslandCore

enum NotchTab: String, CaseIterable, Identifiable {
    case goals, requests, accounts
    var id: String { rawValue }

    var title: String {
        switch self {
        case .goals: return "Obiettivi"
        case .requests: return "Richieste"
        case .accounts: return "Account"
        }
    }

    var symbol: String {
        switch self {
        case .goals: return "target"
        case .requests: return "tray"
        case .accounts: return "person.2"
        }
    }
}

/// The open notch: the tab bar, then the tab. The tab chosen last is kept for the next opening.
struct NotchSections: View {
    let maxHeight: CGFloat
    @ObservedObject private var store = GoalStore.shared
    @ObservedObject private var quota = AccountQuotaFeed.shared
    @AppStorage("notchTab") private var tab: NotchTab = .goals

    var body: some View {
        // Ticks only while the notch is open: "since …" and "updated … ago" are what time moves.
        TimelineView(.periodic(from: .now, by: 30)) { ctx in
            NotchSectionsContent(store: store, quota: quota, now: ctx.date, tab: $tab)
        }
        .hugging(maxHeight: maxHeight)
        .onAppear {  // opening the notch is when fresh numbers matter
            quota.refresh()
            PullRequestFeed.shared.refresh()
        }
    }
}

extension View {
    /// As tall as its content, up to `maxHeight`. A bare `.frame(maxHeight:)` takes all the room it is
    /// offered up to the cap, which left black under a short tab.
    func hugging(maxHeight: CGFloat) -> some View {
        frame(maxHeight: maxHeight, alignment: .top).fixedSize(horizontal: false, vertical: true)
    }
}

/// The tab bar and the tab, without the clock: `--snapshot` draws this. A sideways scroll over the
/// tab bar moves one tab per gesture; gestures during the slide are dropped, so steps never add up.
struct NotchSectionsContent: View {
    @ObservedObject var store: GoalStore
    @ObservedObject var quota: AccountQuotaFeed
    let now: Date
    @Binding var tab: NotchTab
    @State private var forward = true
    @State private var moving = false
    @State private var swipe = PageSwipe()
    @State private var monitor: Any?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: NotchSpace.section) {
            TabBar(tab: Binding(get: { tab }, set: go))
            ZStack(alignment: .top) {
                Group {
                    switch tab {
                    case .goals: GoalsTab(rows: store.rows, now: now)
                    case .requests: RequestsTab(requests: store.requests, active: store.requestsFolderExists)
                    case .accounts: AccountsTab(feed: quota, inUse: AccountsInUseFeed.shared, now: now)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .id(tab)
                .transition(reduceMotion ? .opacity : .push(from: forward ? .trailing : .leading))
            }
            .opacity(moving ? 0.45 : 1)  // as the Pager: nothing is read half-way
            .blur(radius: moving && !reduceMotion ? 2.5 : 0)
            .clipped()
        }
        .padding(.horizontal, NotchSpace.side)
        .padding(.top, 10)
        .padding(.bottom, NotchSpace.bottom)
        .onAppear { startSwipes() }
        .onDisappear { stopSwipes() }
    }

    private func go(_ target: NotchTab) {
        guard target != tab else { return }
        let all = NotchTab.allCases
        forward = all.firstIndex(of: target)! > all.firstIndex(of: tab)!
        moving = true
        withAnimation(NotchMotion.animation(reduce: reduceMotion)) {
            tab = target
        } completion: {
            withAnimation(NotchMotion.still) { moving = false }
        }
    }

    /// Never swallows: over the tab bar the event reaches only buttons, elsewhere the Pager owns it.
    private func startSwipes() {
        guard monitor == nil else { return }
        monitor = NSEvent.addLocalMonitorForEvents(matching: .scrollWheel) { event in
            guard event.window is NSPanel else { return event }
            let step = swipe.feed(event)  // fed always, so each gesture's start is seen
            let all = NotchTab.allCases
            guard TabBarPointer.inside, !moving, let step,
                  let i = PageSwipe.target(from: all.firstIndex(of: tab)!, step: step, count: all.count)
            else { return event }
            go(all[i])
            return event
        }
    }

    private func stopSwipes() {
        if let monitor { NSEvent.removeMonitor(monitor) }
        monitor = nil
    }
}

/// Whether the pointer is over the tab bar: there a sideways scroll moves the tab, not the page.
enum TabBarPointer {
    static var inside = false
}

/// Three 142 × 30 segments in a 38 pt well; the chosen one lifts. One spring moves the highlight.
struct TabBar: View {
    @Binding var tab: NotchTab
    @Namespace private var highlight
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 0) {
            ForEach(NotchTab.allCases) { item in
                // withAnimation, so the notch's height follows the new tab with the same spring as the tab.
                Button { withAnimation(NotchMotion.animation(reduce: reduceMotion)) { tab = item } } label: {
                    HStack(spacing: 6) {
                        Image(systemName: item.symbol)
                        Text(item.title)
                    }
                    .font(item == tab ? NotchType.tab : NotchType.tabOff)
                    .foregroundStyle(item == tab ? GoalInk.primary : GoalInk.off)
                    .frame(maxWidth: .infinity, minHeight: 30)
                    .background {
                        if item == tab {
                            Capsule().fill(GoalInk.selected).matchedGeometryEffect(id: "tab", in: highlight)
                        }
                    }
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(item == tab ? .isSelected : [])
            }
        }
        .padding(4)
        .background(Capsule().fill(GoalInk.well))
        .frame(maxWidth: 434)
        .onHover { TabBarPointer.inside = $0 }
        .onDisappear { TabBarPointer.inside = false }  // closing the notch sends no hover-out
        // The gear sits in the 37 pt beside the centred bar, so it is there on every tab.
        .frame(maxWidth: .infinity)
        .overlay(alignment: .trailing) { NotchSettingsButton() }
    }
}

/// The gear of the open notch: the app's settings window, the same as the menu bar's «Impostazioni…»
/// (where «Personalizza il notch» lives too).
struct NotchSettingsButton: View {
    var open: @MainActor () -> Void = { SettingsWindowController.shared.show() }

    var body: some View {
        NotchIconButton(icon: "gearshape", tooltip: "Apri impostazioni") { open() }
    }
}

/// An empty state: what is (or is not) there, and at most one line on why.
struct EmptyState: View {
    let text: String
    var detail: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: NotchSpace.tight) {
            Text(text).font(NotchType.bodyEmphasis).foregroundStyle(GoalInk.secondary)
            if let detail { Text(detail).font(NotchType.body).foregroundStyle(GoalInk.secondary) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
