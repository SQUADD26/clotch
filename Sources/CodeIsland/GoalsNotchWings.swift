import SwiftUI
import CodeIslandCore

// MARK: - Collapsed and header wings

/// Left wing: collapsed = the design's leading view, snug against the notch (HIG compact
/// presentation: no padding to the camera beyond its rounded corner); expanded = the section title.
struct GoalsLeftWing: View {
    let expanded: Bool
    var design: GoalDesign = .current
    @ObservedObject private var store = GoalStore.shared

    var body: some View {
        if expanded {
            Text("Obiettivi")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(GoalInk.secondary)
                .padding(.leading, 22)
        } else {
            design.collapsedLeading(store.rows)
                .padding(.trailing, 8)
                .frame(width: design.wing, alignment: .trailing)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(store.rows.accessibilitySummary(now: store.now))
        }
    }
}

/// Right wing: collapsed = the design's trailing view, snug against the notch;
/// expanded = the quit button, the only control kept from the old header.
struct GoalsRightWing: View {
    let expanded: Bool
    var design: GoalDesign = .current
    @ObservedObject private var store = GoalStore.shared

    var body: some View {
        if expanded {
            GoalsQuitButton().padding(.trailing, 10)
        } else {
            design.collapsedTrailing(store.rows)
                .padding(.leading, 8)
                .frame(width: design.wing, alignment: .leading)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(sessionsLabel)
        }
    }
}

private extension GoalsRightWing {
    var sessionsLabel: String {
        let n = store.rows.allPulses.count
        return n == 0 ? "Nessuna sessione attiva" : "\(n) \(n == 1 ? "sessione attiva" : "sessioni attive")"
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
