import SwiftUI
import CodeIslandCore

// Places in the notch filled with views from the sister branches' own files (#6).

/// Under each goal page: its open pull requests (#6), and a merged one once.
struct GoalPRSlot: View {
    let row: GoalRow
    var body: some View { GoalPRSection(goal: row.id) }
}
