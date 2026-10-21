import SwiftUI
import CodeIslandCore

/// One notch element, drawn from real data on the black island. The Figma samples in «Personalizza il notch»
/// (NotchElementSample) are the static stand-ins of these.
struct NotchElementView: View {
    let element: NotchElement
    let data: NotchZoneData

    var body: some View {
        switch element {
        case .goalRings: GoalRingsElement(data: data)
        case .activeGoal: ActiveGoalElement(data: data)
        case .accounts: AccountBarsElement(data: data)
        case .accountsWide: AccountsWideElement(data: data)
        case .pendingRequests: CountElement(symbol: "tray", count: data.requestsWaiting, label: "Richieste in attesa")
        case .workingSessions: CountElement(symbol: "terminal", count: data.workingSessions, label: "Sessioni al lavoro")
        }
    }
}

// MARK: - Goals

/// One ring per open goal, as in the closed notch's wing (`GoalRing`): the arc is its declared proofs done. A goal with no
/// declared proofs is a bare track, never an invented fill.
private struct GoalRingsElement: View {
    let data: NotchZoneData
    /// shortcut: a fifth goal and later ones get no ring (the open notch pages them all); a "+N" mark if Roberto asks.
    private let shown = 4

    var body: some View {
        HStack(spacing: 5) {  // centres 17 pt apart
            ForEach(data.rows.pages.prefix(shown)) { row in
                GoalRing(row: row, size: 12, line: 2.2)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(data.rows.accessibilitySummary(now: data.now))
    }
}

/// The goal chased now and, when a source gives it, how long work on it has run. `Text(_, style: .timer)`
/// is drawn by the system: no timer of ours.
private struct ActiveGoalElement: View {
    let data: NotchZoneData

    var body: some View {
        if let hero = data.rows.hero {
            HStack(spacing: 10) {
                if !data.iconsOnly { Text(hero.title).font(NotchType.name).foregroundStyle(GoalInk.primary).lineLimit(1).truncationMode(.tail) }
                if let since = data.workingSince {
                    HStack(spacing: 5) {
                        Image(systemName: "stopwatch").font(.system(size: 15))
                        Text(since, style: .timer).font(NotchType.name.monospacedDigit()).tracking(0.26)
                    }
                    .foregroundStyle(Color.white.opacity(0.75))
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(hero.accessibilityText(now: data.now))
        } else {
            Text("Nessun obiettivo aperto").font(NotchType.bodyEmphasis).foregroundStyle(GoalInk.secondary)
        }
    }
}

// MARK: - Counts

private struct CountElement: View {
    let symbol: String
    let count: Int
    let label: String

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: symbol).font(.system(size: 12, weight: .medium))
            Text("\(count)").font(NotchType.numbers).contentTransition(.numericText())
        }
        .foregroundStyle(count > 0 ? GoalInk.primary : GoalInk.secondary)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(count)")
    }
}
