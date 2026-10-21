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

/// One ring per open goal: the arc is its declared proofs done, the colour its state. A goal with no
/// declared proofs is a bare track, never an invented fill.
private struct GoalRingsElement: View {
    let data: NotchZoneData
    private let shown = 6

    var body: some View {
        HStack(spacing: 6) {
            ForEach(data.rows.prefix(shown)) { row in
                Ring(progress: row.progress, color: row.ink)
            }
            if data.rows.count > shown {
                Text("+\(data.rows.count - shown)").font(NotchType.numbers).foregroundStyle(GoalInk.secondary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(data.rows.accessibilitySummary(now: data.now))
    }
}

private struct Ring: View {
    let progress: Double?
    let color: Color

    var body: some View {
        ZStack {
            Circle().stroke(GoalInk.track, lineWidth: 2.5)
            if let progress, progress > 0 {
                Circle().trim(from: 0, to: min(progress, 1))
                    .stroke(color, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
        }
        .frame(width: 16, height: 16)
    }
}

/// The goal chased now and, when a source gives it, how long work on it has run. `Text(_, style: .timer)`
/// is drawn by the system: no timer of ours.
private struct ActiveGoalElement: View {
    let data: NotchZoneData

    var body: some View {
        if let hero = data.rows.hero {
            HStack(spacing: 10) {
                Text(hero.title).font(NotchType.title).foregroundStyle(GoalInk.primary).lineLimit(1).truncationMode(.tail)
                if let since = data.workingSince {
                    HStack(spacing: 5) {
                        Image(systemName: "timer").font(.system(size: 13, weight: .medium))
                        Text(since, style: .timer).font(NotchType.title.monospacedDigit().weight(.medium))
                    }
                    .foregroundStyle(GoalInk.secondary)
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
