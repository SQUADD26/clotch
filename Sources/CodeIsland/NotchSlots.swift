import SwiftUI
import CodeIslandCore

// Places in the notch that sister branches fill with views from their own files. Each slot is
// empty here; the branch that builds the piece replaces the body with its view, one line.

/// Under each goal page: its open pull requests (#6), and a merged one once.
struct GoalPRSlot: View {
    let row: GoalRow
    var body: some View { GoalPRSection(goal: row.id) }
}

/// Over the closed notch's account bars: the detail of each account on hover (#5).
struct AccountsHoverSlot: View {
    var body: some View { EmptyView() }
}

/// The closed notch's centre on a screen without a hardware notch (#5). `hasNotch` false only.
struct CenterZoneSlot: View {
    let rows: [GoalRow]
    var body: some View { EmptyView() }
}
