import SwiftUI
import CodeIslandCore

/// C, "Strisce": dense and columnar. Closed, one strip split into a segment per goal
/// (each segment is that goal's bar) and a live meter of the sessions; open, one line per goal
/// with every column aligned, the reason under the title only when the goal is not green.
enum GoalDesignC {
    struct Leading: View {
        let rows: [GoalRow]

        var body: some View {
            // shortcut: 4 segments at most, the most urgent goals; the open list has them all.
            HStack(spacing: 2) {
                ForEach(Array(rows.prefix(4))) { row in
                    GoalBar(progress: row.progress, tone: row.tone, height: 5)
                }
            }
            .frame(width: 34)
        }
    }

    struct Trailing: View {
        let rows: [GoalRow]

        var body: some View {
            SessionCount(pulses: rows.allPulses, cap: 4, bounce: true, size: 12)
        }
    }

    struct Rows: View {
        let rows: [GoalRow]
        let now: Date
        @Binding var hovered: String?

        var body: some View {
            VStack(spacing: 2) {
                ForEach(rows) { row in
                    Line(row: row, now: now, hovered: hovered == row.id)
                        .goalHover(row.id, $hovered)
                }
            }
            .padding(.horizontal, 12)
            .padding(.top, 6)
            .padding(.bottom, 12)
        }
    }

    private struct Line: View {
        let row: GoalRow
        let now: Date
        let hovered: Bool

        /// Glyph column width + spacing: the second lines start under the title.
        private let indent: CGFloat = 22

        var body: some View {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 10) {
                    Image(systemName: row.symbol)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(row.tone.color)
                        .frame(width: 12)
                    Text(row.displayTitle)
                        .font(.system(size: 12.5, weight: .medium))
                        .foregroundStyle(GoalInk.primary)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    GoalBar(progress: row.progress, tone: row.tone, height: 4).frame(width: 110)
                    Text(row.proofsText ?? "–")
                        .font(.system(size: 11.5, weight: .medium).monospacedDigit())
                        .foregroundStyle(GoalInk.secondary)
                        .frame(width: 34, alignment: .trailing)
                    SessionCount(pulses: row.pulses, cap: 4, bounce: true, size: 11.5)
                        .frame(width: 40, alignment: .trailing)
                }
                if let reason = row.reason(now: now) {
                    Text(reason)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(row.tone.color)
                        .lineLimit(1)
                        .padding(.leading, indent)
                }
                if hovered {
                    VStack(alignment: .leading, spacing: 2) {
                        if !row.title.isEmpty { Text(row.goal).lineLimit(3) }
                        Text(row.proofsTotal > 0 ? "\(row.proofsDone) prove su \(row.proofsTotal)" : "Nessuna prova dichiarata")
                        if !row.pulses.isEmpty { Text(row.sessionsText) }
                    }
                    .font(.system(size: 11))
                    .foregroundStyle(GoalInk.secondary)
                    .padding(.leading, indent)
                    .padding(.top, 2)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color.white.opacity(hovered ? 0.07 : 0))
            )
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(row.accessibilityText(now: now))
        }
    }
}
