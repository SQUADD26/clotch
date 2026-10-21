import SwiftUI
import CodeIslandCore

// Places in the notch filled with views from the sister branches' own files (#6, #7).

/// Under each goal page: its open pull requests (#6), and a merged one once.
struct GoalPRSlot: View {
    let row: GoalRow
    var body: some View { GoalPRSection(goal: row.id) }
}

/// Over the closed notch's account bars: on hover, the card with each account's 5 hours and week (#7),
/// hanging 8 pt under the bar (Figma 11).
struct AccountsHoverSlot: View {
    @ObservedObject private var quota = AccountQuotaFeed.shared
    @ObservedObject private var inUse = AccountsInUseFeed.shared
    @State private var hovering = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Color.clear
            .contentShape(Rectangle())
            .onHover { hovering = $0 }
            .overlay(alignment: .bottom) {
                if hovering, !inUse.emails.isEmpty {
                    AccountsDetailCard(data: NotchZoneData(accounts: quota.accounts, inUse: inUse.emails))
                        .fixedSize()
                        .allowsHitTesting(false)
                        .alignmentGuide(.bottom) { $0[.top] - 8 }
                        .transition(reduceMotion ? .opacity : .opacity.combined(with: .scale(scale: 0.96, anchor: .top)))
                }
            }
            .animation(NotchMotion.animation(reduce: reduceMotion), value: hovering)
    }
}

/// The closed notch's centre on a screen without a hardware notch: the goal chased now and its work
/// time (#7, Figma 09). `hasNotch` false only.
/// shortcut: always the standard centre (active goal); the per-screen layout of «Personalizza il notch» is not read yet.
struct CenterZoneSlot: View {
    let rows: [GoalRow]
    var body: some View {
        NotchElementView(element: .activeGoal, data: NotchZoneData(rows: rows, workingSince: rows.hero?.since))
    }
}
