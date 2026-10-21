import SwiftUI
import CodeIslandCore

// MARK: - Collapsed wings

/// The closed notch answers «are we getting closer?» for the goal chased now, as one piece of
/// information across the camera (HIG compact presentation): its state and bar on the left, its proof
/// count on the right (or the sessions running, when it has no declared proofs). Snug against the notch.
enum GoalsWing {
    /// Content + 8pt to the notch + 10pt outer margin; both wings the same, so the island stays centred.
    static let width: CGFloat = 56
}

struct GoalsLeftWing: View {
    let expanded: Bool
    @ObservedObject private var store = GoalStore.shared

    var body: some View {
        // Both wings always take their width, even empty, so the pair stays centred on the notch.
        if !expanded {
            HStack(spacing: 5) {
                if let hero = store.rows.hero {
                    Image(systemName: hero.symbol)
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(hero.tone.color)
                        .contentTransition(.symbolEffect(.replace))
                    GoalBar(progress: hero.progress, tone: hero.tone, height: 5).frame(width: 26)
                }
            }
            .padding(.trailing, 8)
            .frame(width: GoalsWing.width, alignment: .trailing)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(store.rows.accessibilitySummary(now: store.now))
        }
    }
}

struct GoalsRightWing: View {
    let expanded: Bool
    @ObservedObject private var store = GoalStore.shared

    var body: some View {
        if !expanded {
            HStack(spacing: 0) {
                if let hero = store.rows.hero, let proofs = hero.proofsText {
                    Text(proofs)
                        .font(.system(size: 12, weight: .semibold).monospacedDigit())
                        .foregroundStyle(GoalInk.primary)
                        .contentTransition(.numericText())
                } else if let hero = store.rows.hero {
                    SessionsLive(row: hero, size: 12, compact: true)
                }
            }
            .padding(.leading, 8)
            .frame(width: GoalsWing.width, alignment: .leading)
            .accessibilityHidden(true)  // the left wing reads the whole goal
        }
    }
}
