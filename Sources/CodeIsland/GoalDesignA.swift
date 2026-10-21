import SwiftUI
import CodeIslandCore

/// A, "Elenco": a quiet macOS list. One stacked mini bar per goal beside the notch,
/// the sessions on the other side; open, each goal reads top-down like a Reminders row.
enum GoalDesignA {
    struct Leading: View {
        let rows: [GoalRow]

        var body: some View {
            VStack(alignment: .trailing, spacing: 3) {
                // shortcut: shows the 3 most urgent goals; the open list has them all.
                ForEach(Array(rows.prefix(3))) { row in
                    GoalBar(progress: row.progress, tone: row.tone, height: 3.5).frame(width: 28)
                }
            }
        }
    }

    struct Trailing: View {
        let rows: [GoalRow]

        var body: some View {
            SessionCount(pulses: rows.allPulses, cap: 4, size: 12)
        }
    }

    struct Rows: View {
        let rows: [GoalRow]
        let now: Date
        @Binding var hovered: String?

        var body: some View {
            VStack(spacing: 4) {
                ForEach(rows) { row in
                    RowView(row: row, now: now, hovered: hovered == row.id)
                        .goalHover(row.id, $hovered)
                }
            }
            .padding(.horizontal, 12)
            .padding(.top, 8)
            .padding(.bottom, 12)
        }
    }

    private struct RowView: View {
        let row: GoalRow
        let now: Date
        let hovered: Bool

        var body: some View {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(row.displayTitle)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(GoalInk.primary)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    SessionCount(pulses: row.pulses, size: 12)
                }
                if !row.title.isEmpty {
                    Text(row.goal)
                        .font(.system(size: 11.5))
                        .foregroundStyle(GoalInk.secondary)
                        .lineLimit(hovered ? 3 : 1)
                }
                HStack(spacing: 10) {
                    GoalBar(progress: row.progress, tone: row.tone, height: 5)
                    Text(row.proofsText ?? "Nessuna prova")
                        .font(.system(size: 11.5, weight: .medium).monospacedDigit())
                        .foregroundStyle(GoalInk.secondary)
                        .fixedSize()
                }
                .padding(.top, 2)
                GoalReason(row: row, now: now)
                if hovered, !row.pulses.isEmpty {
                    Text(row.sessionsText)
                        .font(.system(size: 11))
                        .foregroundStyle(GoalInk.secondary)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 9)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.white.opacity(hovered ? 0.07 : 0))
            )
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(row.accessibilityText(now: now))
        }
    }
}
