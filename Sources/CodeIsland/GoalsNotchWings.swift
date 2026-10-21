import SwiftUI
import CodeIslandCore

// MARK: - Collapsed and header wings

/// Left wing: collapsed = one tiny bar per goal (up to 4), expanded = the section title.
struct GoalsLeftWing: View {
    let expanded: Bool
    @ObservedObject private var store = GoalStore.shared

    var body: some View {
        Group {
            if expanded {
                Text("Obiettivi")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.white.opacity(0.6))
            } else if !store.rows.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(Array(store.rows.prefix(4))) { row in
                        GoalBar(progress: row.progress, tone: row.tone, height: 3)
                            .frame(width: 24)
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(store.rows.count) obiettivi aperti")
            }
        }
        .padding(.leading, 10)
    }
}

/// Right wing: collapsed = sessions running now across all goals (nothing at 0),
/// expanded = the quit button, the only control kept from the old header.
struct GoalsRightWing: View {
    let expanded: Bool
    @ObservedObject private var store = GoalStore.shared

    private var running: Int { store.rows.reduce(0) { $0 + $1.runningCount } }

    var body: some View {
        Group {
            if expanded {
                GoalsQuitButton()
            } else if running > 0 {
                Text("\(running)")
                    .font(.system(size: 12, weight: .semibold).monospacedDigit())
                    .foregroundStyle(Color.white.opacity(0.85))
                    .help("\(running) in corso")
            }
        }
        .padding(.trailing, 10)
    }
}

private struct GoalsQuitButton: View {
    @StateObject private var quit = QuitConfirmation()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        QuitConfirmButton(confirmation: quit)
            .animation(reduceMotion ? nil : NotchAnimation.micro, value: quit.isArmed)
    }
}
