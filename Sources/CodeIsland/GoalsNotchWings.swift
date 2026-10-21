import SwiftUI
import CodeIslandCore

// MARK: - Collapsed wings

/// The closed notch, black like the hardware one: a ring per goal on the left (the goal chased now
/// first), a bar per account in use on the right. Nothing in it moves unless the data changes.
enum GoalsWing {
    /// Both wings the same, so the island stays centred; each centres its marks.
    static let width = NotchSize.wing
    /// shortcut: a fifth goal and later ones get no ring (the open notch pages them all); a "+N" mark if Roberto asks.
    static let rings = 4
}

struct GoalsLeftWing: View {
    @ObservedObject private var store = GoalStore.shared

    var body: some View {
        HStack(spacing: 5) {  // centres 17 pt apart
            ForEach(store.rows.pages.prefix(GoalsWing.rings)) { row in
                GoalRing(row: row, size: 12, line: 2.2)
            }
        }
        .frame(width: GoalsWing.width)
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
                .frame(width: GoalsWing.width)
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
        HStack(spacing: 4) {  // 10 pt pitch
            ForEach(shown) { account in
                AccountBar(used: account.sevenDay.usedNow(now))
            }
        }
        .overlay { AccountsHoverSlot() }
        .frame(width: GoalsWing.width)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(shown.map { a in
            "\(a.label) " + (a.sevenDay.usedNow(now).map { "settimana \(Int($0.rounded())) per cento" } ?? "libero")
        }.joined(separator: ", "))
    }
}

/// One account as a 6 × 16 bar filled from the bottom by its weekly usage.
private struct AccountBar: View {
    let used: Double?

    var body: some View {
        let bar = RoundedRectangle(cornerRadius: 3, style: .continuous)
        ZStack(alignment: .bottom) {
            bar.fill(GoalInk.barTrack)
            if let used, used > 0 {
                bar.fill(QuotaTone.color(used)).frame(height: max(4, 16 * CGFloat(min(used, 100)) / 100))
            }
        }
        .frame(width: 6, height: 16)
    }
}
