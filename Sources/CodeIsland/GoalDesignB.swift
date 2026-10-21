import SwiftUI
import CodeIslandCore

/// B, "Attività": a Live Activity. Closed, the island speaks for the most urgent goal only
/// (state shape on the left, its bar on the right, one piece of information across the camera);
/// open, each goal is an inset card with the proof count as the large number.
enum GoalDesignB {
    struct Leading: View {
        let rows: [GoalRow]

        var body: some View {
            if let worst = rows.worst {
                Image(systemName: worst.symbol)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(worst.tone.color)
                    .contentTransition(.symbolEffect(.replace))
            }
        }
    }

    struct Trailing: View {
        let rows: [GoalRow]

        var body: some View {
            if let worst = rows.worst {
                GoalBar(progress: worst.progress, tone: worst.tone, height: 5).frame(width: 28)
            }
        }
    }

    struct Rows: View {
        let rows: [GoalRow]
        let now: Date
        @Binding var hovered: String?

        var body: some View {
            // 10pt inset with 14pt cards: concentric with the panel's 24pt bottom corners.
            VStack(spacing: 8) {
                ForEach(rows) { row in
                    Card(row: row, now: now, hovered: hovered == row.id)
                        .goalHover(row.id, $hovered)
                }
            }
            .padding(.horizontal, 10)
            .padding(.top, 6)
            .padding(.bottom, 10)
        }
    }

    private struct Card: View {
        let row: GoalRow
        let now: Date
        let hovered: Bool

        var body: some View {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(row.displayTitle)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(GoalInk.primary)
                            .lineLimit(1)
                        if !row.title.isEmpty {
                            Text(row.goal)
                                .font(.system(size: 11.5))
                                .foregroundStyle(GoalInk.secondary)
                                .lineLimit(hovered ? 3 : 1)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    proofs
                }
                GoalBar(progress: row.progress, tone: row.tone, height: 6)
                if row.reason(now: now) != nil || !row.pulses.isEmpty {
                    HStack(spacing: 10) {
                        GoalReason(row: row, now: now)
                        Spacer(minLength: 0)
                        if hovered, !row.pulses.isEmpty {
                            Text(row.sessionsText)
                                .font(.system(size: 11))
                                .foregroundStyle(GoalInk.secondary)
                                .lineLimit(1)
                        } else {
                            SessionCount(pulses: row.pulses, size: 11.5)
                        }
                    }
                }
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.white.opacity(hovered ? 0.11 : 0.07))
            )
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(row.accessibilityText(now: now))
        }

        @ViewBuilder private var proofs: some View {
            if row.proofsTotal > 0 {
                HStack(alignment: .firstTextBaseline, spacing: 1) {
                    Text("\(row.proofsDone)")
                        .font(.system(size: 22, weight: .semibold, design: .rounded).monospacedDigit())
                        .foregroundStyle(GoalInk.primary)
                        .contentTransition(.numericText())
                    Text("/\(row.proofsTotal)")
                        .font(.system(size: 13, weight: .medium, design: .rounded).monospacedDigit())
                        .foregroundStyle(GoalInk.secondary)
                }
                .fixedSize()
            } else {
                Text("Nessuna prova")
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(GoalInk.secondary)
                    .fixedSize()
            }
        }
    }
}
