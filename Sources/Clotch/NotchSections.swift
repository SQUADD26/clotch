import AppKit
import SwiftUI
import ClotchCore

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

extension NotchTab {
    /// The tabs Roberto keeps on in Impostazioni (#56), in order; never none.
    static func visible(hidden: String) -> [NotchTab] {
        ClotchPrefs.visibleTabs(allCases.map(\.rawValue), hidden: hidden).compactMap(NotchTab.init)
    }
}

/// The open notch: the tab bar, then the tab. The tab chosen last is kept for the next opening.
struct NotchSections: View {
    let maxHeight: CGFloat
    @ObservedObject private var store = GoalStore.shared
    @ObservedObject private var quota = AccountQuotaFeed.shared
    @AppStorage("notchTab") private var tab: NotchTab = .goals
    @ObservedObject private var afk = AfkStore.shared

    var body: some View {
        Group {
            // Back from AFK (#106): the summary stands in for the tabs until it is closed.
            if let report = afk.report {
                AfkSummaryView(report: report, maxHeight: maxHeight)
            } else {
                // Ticks only while the notch is open: "since …" and "updated … ago" are what time moves.
                TimelineView(.periodic(from: .now, by: 30)) { ctx in
                    NotchSectionsContent(store: store, quota: quota, now: ctx.date, tab: $tab)
                }
            }
        }
        .hugging(maxHeight: maxHeight)
        .onAppear {  // opening the notch is when fresh numbers matter
            quota.refresh()
            PullRequestFeed.shared.refresh()
        }
        .onDisappear { afk.dismiss(closing: false) }  // closed by the pointer: the next opening shows the tabs
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
/// tab bar moves one tab per gesture; a gesture during the slide starts at once (#119).
struct NotchSectionsContent: View {
    @ObservedObject var store: GoalStore
    @ObservedObject var quota: AccountQuotaFeed
    let now: Date
    @Binding var tab: NotchTab
    @AppStorage(ClotchPrefs.hiddenTabs) private var hiddenTabs = ClotchPrefs.hiddenTabsDefault
    @State private var forward = true
    @State private var swipe = PageSwipe()
    @State private var monitor: Any?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// A tab turned off in Impostazioni is never shown, even if it was the last one open.
    private var shown: NotchTab { tabs.contains(tab) ? tab : tabs[0] }
    private var tabs: [NotchTab] { NotchTab.visible(hidden: hiddenTabs) }

    var body: some View {
        VStack(spacing: NotchSpace.section) {
            TabBar(tab: Binding(get: { shown }, set: go), tabs: tabs, badge: store.newAnswerCount > 0 ? (.requests, store.newAnswerCount) : nil)
            ZStack(alignment: .top) {
                Group {
                    switch shown {
                    case .goals: GoalsTab(rows: store.rows, now: now)
                    case .requests: RequestsTab(requests: store.requests, active: store.requestsFolderExists, now: now, seenAt: store.answersSeenAt)
                    case .accounts: AccountsTab(feed: quota, inUse: AccountsInUseFeed.shared, now: now)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .id(shown)
                .transition(reduceMotion ? .opacity : .push(from: forward ? .trailing : .leading))
            }
            .clipped()
        }
        .padding(.horizontal, NotchSpace.side)
        .padding(.top, 10)
        .padding(.bottom, NotchSpace.bottom)
        .onAppear { startSwipes() }
        .onDisappear { stopSwipes() }
    }

    private func go(_ target: NotchTab) {
        guard target != shown else { return }
        let all = NotchTab.allCases
        forward = all.firstIndex(of: target)! > all.firstIndex(of: shown)!
        withAnimation(NotchMotion.animation(reduce: reduceMotion)) { tab = target }
    }

    /// Never swallows: over the tab bar the event reaches only buttons, elsewhere the Pager owns it.
    private func startSwipes() {
        guard monitor == nil else { return }
        monitor = NSEvent.addLocalMonitorForEvents(matching: .scrollWheel) { event in
            guard event.window is NSPanel else { return event }
            let step = swipe.feed(event)  // fed always, so each gesture's start is seen
            let all = tabs
            guard TabBarPointer.inside, let step,
                  let i = PageSwipe.target(from: all.firstIndex(of: shown) ?? 0, step: step, count: all.count)
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
    var tabs = NotchTab.allCases
    /// The tab with a yellow number, no box (new answers, #90, #114); never the open one.
    var badge: (tab: NotchTab, count: Int)? = nil
    /// The AFK moon's state for `--snapshot`; nil = live.
    var afkOn: Bool? = nil
    @Namespace private var highlight
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 0) {
            ForEach(tabs) { item in
                // withAnimation, so the notch's height follows the new tab with the same spring as the tab.
                Button { withAnimation(NotchMotion.animation(reduce: reduceMotion)) { tab = item } } label: {
                    HStack(spacing: 6) {
                        Image(systemName: item.symbol)
                        Text(item.title)
                        if let badge, badge.tab == item, item != tab {
                            Text("\(badge.count)")
                                .font(.system(size: FigmaToken.MacOS27GoldenGate.notchTesto11, weight: .semibold))
                                .foregroundStyle(FigmaToken.MacOS27GoldenGate.notchGiallo)
                                .accessibilityLabel(badge.count == 1 ? "1 nuova risposta" : "\(badge.count) nuove risposte")
                        }
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
                .buttonStyle(.notch)
                .accessibilityAddTraits(item == tab ? .isSelected : [])
            }
        }
        .padding(4)
        .background(Capsule().fill(GoalInk.well))
        .frame(maxWidth: 434)
        .onHover { TabBarPointer.inside = $0 }
        .onDisappear { TabBarPointer.inside = false }  // closing the notch sends no hover-out
        // The gear and the AFK moon (#106) on the right of the bar, so they are there on every tab.
        .padding(.trailing, 86)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .trailing) {
            HStack(spacing: 12) {
                NotchSettingsButton()
                AfkButton(on: afkOn)
            }
        }
    }
}

/// The gear of the open notch: the app's settings window, the same as the menu bar's «Impostazioni…»
/// (where «Personalizza il notch» lives too).
struct NotchSettingsButton: View {
    var open: @MainActor () -> Void = { NotchExit.close(); SettingsWindowController.shared.show() }

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
