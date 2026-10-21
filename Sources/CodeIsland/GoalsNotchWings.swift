import SwiftUI
import CodeIslandCore

// MARK: - Collapsed wings

/// The closed notch, black like the hardware one: a ring per goal on the left (the goal chased now
/// first), a bar per account in use on the right. Nothing in it moves unless the data changes.
enum GoalsWing {
    /// Four 13 pt rings 5 pt apart, 8 pt to the notch, 12 pt outer margin; both wings the same, so the
    /// island stays centred.
    static let width: CGFloat = 92
    /// shortcut: a fifth goal and later ones get no ring (the open notch pages them all); a "+N" mark if Roberto asks.
    static let rings = 4
}

struct GoalsLeftWing: View {
    @ObservedObject private var store = GoalStore.shared

    var body: some View {
        HStack(spacing: 5) {
            ForEach(store.rows.pages.prefix(GoalsWing.rings)) { row in
                GoalRing(row: row, size: 13, line: 2.5)
            }
        }
        .padding(.trailing, 8)
        .frame(width: GoalsWing.width, alignment: .trailing)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(store.rows.accessibilitySummary(now: Date()))
    }
}

struct GoalsRightWing: View {
    @ObservedObject private var quota = AccountQuotaFeed.shared
    @ObservedObject private var inUse = AccountsInUseFeed.shared
    @ObservedObject private var notifier = NotchNotifier.shared
    @ObservedObject private var store = GoalStore.shared

    var body: some View {
        if notifier.phase == .leave, let event = notifier.current {
            ResultMark(event: event, rows: store.rows)
                .padding(.leading, 8)
                .frame(width: GoalsWing.width, alignment: .leading)
                .transition(.scale(scale: 0.4).combined(with: .opacity))
        } else {
            bars
        }
    }

    @ViewBuilder private var bars: some View {
        let now = Date()
        // The accounts in use on this Mac; none running, the dashboard's own order.
        let running = quota.accounts.filter { inUse.emails.contains($0.email) }
        let shown = (running.isEmpty ? quota.accounts : running).filter { !$0.stale(now) }.prefix(4)
        HStack(spacing: 4) {
            ForEach(shown) { account in
                // The window closer to its limit is the one that stops work first.
                let used = [account.fiveHour.usedNow(now), account.sevenDay.usedNow(now)].compactMap { $0 }.max()
                AccountBar(used: used)
            }
        }
        .overlay { AccountsHoverSlot() }
        .padding(.leading, 8)
        .frame(width: GoalsWing.width, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(shown.map { a in
            "\(a.label) " + ([a.fiveHour.usedNow(now), a.sevenDay.usedNow(now)].compactMap { $0 }.max().map { "\(Int($0.rounded())) per cento" } ?? "libero")
        }.joined(separator: ", "))
    }
}

/// One account as a vertical bar filled from the bottom.
private struct AccountBar: View {
    let used: Double?

    var body: some View {
        ZStack(alignment: .bottom) {
            Capsule().fill(GoalInk.track)
            if let used, used > 0 {
                Capsule().fill(QuotaTone.color(used)).frame(height: max(5.5, 18 * CGFloat(min(used, 100)) / 100))
            }
        }
        .frame(width: 5.5, height: 18)
    }
}
