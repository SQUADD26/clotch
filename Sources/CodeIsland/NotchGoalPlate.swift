import SwiftUI
import CodeIslandCore

/// The goal chased now, large, then the other goals as aligned lines. The plate's glass takes the
/// chased goal's traffic light as a faint tint: state, not decoration.
struct GoalPlate: View {
    let rows: [GoalRow]
    let now: Date

    var body: some View {
        let hero = rows.hero
        let others = rows.filter { $0.id != hero?.id }
        // Two goals with one title (two Overseers) are told apart by their goal text.
        let repeated = Set(Dictionary(grouping: rows, by: \.title).filter { $0.value.count > 1 }.keys)
        Plate(title: "Obiettivo", tint: hero?.tone.color.opacity(0.16)) {
            if let hero { SessionsLive(row: hero, size: 11) }
        } content: {
            if let hero {
                VStack(alignment: .leading, spacing: NotchSpace.head) {
                    HeroGoal(row: hero, now: now)
                    if !others.isEmpty {
                        Rectangle().fill(Color.white.opacity(0.1)).frame(height: 0.5)
                        VStack(alignment: .leading, spacing: NotchSpace.row) {
                            ForEach(others) { OtherGoal(row: $0, now: now, showGoal: repeated.contains($0.title) && $0.hasSubtitle) }
                        }
                    }
                }
            } else {
                EmptyState(text: "Nessun obiettivo aperto")
            }
        }
    }
}

private struct HeroGoal: View {
    let row: GoalRow
    let now: Date

    var body: some View {
        VStack(alignment: .leading, spacing: NotchSpace.head) {
            VStack(alignment: .leading, spacing: NotchSpace.tight) {
                HStack(alignment: .firstTextBaseline, spacing: NotchSpace.head) {
                    Text(row.title)
                        .font(NotchType.title)
                        .foregroundStyle(GoalInk.primary)
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if row.proofsTotal > 0 {
                        HStack(alignment: .firstTextBaseline, spacing: 1) {
                            Text("\(row.proofsDone)")
                                .font(NotchType.figure)
                                .foregroundStyle(GoalInk.primary)
                                .contentTransition(.numericText())
                            Text("/\(row.proofsTotal)").font(NotchType.figureUnit).foregroundStyle(GoalInk.secondary)
                        }
                        .fixedSize()
                    }
                }
                if row.hasSubtitle {
                    Text(row.goal).font(NotchType.secondary).foregroundStyle(GoalInk.secondary).lineLimit(2)
                }
            }
            // The reason belongs to the bar: 4 pt under it, never a separate block.
            VStack(alignment: .leading, spacing: NotchSpace.tight) {
                GoalBar(progress: row.progress, tone: row.tone, height: 6)
                if row.reason(now: now) != nil {
                    GoalReason(row: row, now: now, size: 11)
                } else if row.proofsTotal == 0 {
                    Text("Nessuna prova dichiarata").font(NotchType.caption).foregroundStyle(GoalInk.secondary)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(row.accessibilityText(now: now))
    }
}

private struct OtherGoal: View {
    let row: GoalRow
    let now: Date
    let showGoal: Bool
    /// State column + spacing: the reason line starts under the title.
    private static let indent: CGFloat = 12 + NotchSpace.row

    var body: some View {
        VStack(alignment: .leading, spacing: NotchSpace.tight) {
            HStack(spacing: NotchSpace.row) {
                Image(systemName: row.symbol)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(row.tone.color)
                    .frame(width: 12)
                Text(row.title)
                    .font(NotchType.bodyEmphasis)
                    .foregroundStyle(GoalInk.primary)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                // No declared proofs: the bare track says it.
                GoalBar(progress: row.progress, tone: row.tone, height: 4).frame(width: 96)
                Text(row.proofsText ?? "")
                    .font(NotchType.numbers)
                    .foregroundStyle(GoalInk.secondary)
                    .frame(width: NotchSpace.figureColumn, alignment: .trailing)
                SessionsLive(row: row, size: 11, compact: true).frame(width: 40, alignment: .trailing)
            }
            if showGoal {
                Text(row.goal)
                    .font(NotchType.caption)
                    .foregroundStyle(GoalInk.secondary)
                    .lineLimit(1)
                    .padding(.leading, Self.indent)
            }
            if let reason = row.reason(now: now) {
                Text(reason)
                    .font(NotchType.caption)
                    .foregroundStyle(row.tone.color)
                    .lineLimit(1)
                    .padding(.leading, Self.indent)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(row.accessibilityText(now: now))
    }
}
