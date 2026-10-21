import AppKit
import SwiftUI
import CodeIslandCore

/// The Goals tab: one page per goal, the goal chased now first, paged sideways.
struct GoalsTab: View {
    let rows: [GoalRow]
    let now: Date
    /// The page shown, by goal id, so a reload that reorders the goals keeps it.
    @State private var shownId: String?

    var body: some View {
        let pages = rows.pages
        if pages.isEmpty {
            EmptyState(text: "Nessun obiettivo aperto")
        } else {
            let index = Binding<Int>(
                get: { pages.firstIndex { $0.id == shownId } ?? 0 },
                set: { shownId = pages.indices.contains($0) ? pages[$0].id : nil }
            )
            Pager(count: pages.count, index: index) { i in
                GoalPage(row: pages[i], position: i + 1, of: pages.count, now: now)
            } footer: { go in
                if pages.count > 1 { PageControl(count: pages.count, index: index.wrappedValue, go: go) }
            }
        }
    }
}

/// One goal: where it is, its name (a link to its master session), its text, the ring of proofs,
/// the sessions at work and the work time, then its pull requests.
struct GoalPage: View {
    let row: GoalRow
    let position: Int
    let of: Int
    let now: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                IconLabel(symbol: "target", text: "Obiettivo \(position) di \(of)")
                Spacer()
                StatusPill(text: row.statusLabel, color: row.ink)
            }
            HStack(alignment: .center, spacing: NotchSpace.section) {
                VStack(alignment: .leading, spacing: 6) {
                    GoalTitle(row: row)
                    if row.hasSubtitle {
                        Text(row.goal).font(NotchType.body).foregroundStyle(GoalInk.description).lineLimit(2)
                            .frame(maxWidth: 412, alignment: .leading)
                    }
                    if let reason = row.reason(now: now) {
                        Text(reason).font(NotchType.caption).foregroundStyle(row.ink).lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                ZStack {
                    GoalRing(row: row, size: 64, line: 5)
                    VStack(spacing: 0) {
                        Text(row.proofsText ?? "–").font(NotchType.ringFigure).foregroundStyle(GoalInk.primary)
                        Text("prove").font(.system(size: 10, weight: .medium)).foregroundStyle(GoalInk.secondary)
                    }
                }
            }
            HStack(spacing: NotchSpace.section) {
                IconLabel(symbol: "apple.terminal", text: row.sessionsText, color: GoalInk.strong)
                if let since = row.since, !row.proposed {
                    HStack(spacing: 6) {
                        Image(systemName: "stopwatch").font(.system(size: 15)).foregroundStyle(GoalInk.strong)
                        WorkTimer(since: since)
                    }
                    .accessibilityElement(children: .combine)
                }
                Spacer()
                Text(row.proofsSentence)
                    .font(NotchType.caption)
                    .foregroundStyle(row.proofsTotal > 0 ? row.ringInk : GoalInk.secondary)
            }
            GoalPRSlot(row: row)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(row.accessibilityText(now: now))
    }
}

/// The goal's name; with a master session it is a link (↗) that opens it in the Claude app.
private struct GoalTitle: View {
    let row: GoalRow
    @State private var hovered = false

    var body: some View {
        let link = row.masterLink
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(row.title).font(NotchType.title).tracking(-0.24).foregroundStyle(GoalInk.primary).lineLimit(1)
            if link != nil {
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 14))
                    .foregroundStyle(hovered ? GoalInk.primary : Color.white.opacity(0.5))
            }
        }
        .contentShape(Rectangle())
        .onHover { hovered = link != nil && $0 }
        .onTapGesture { if let link { NSWorkspace.shared.open(link) } }
        .help(link != nil ? "Apri sessione master" : "")
        .accessibilityAddTraits(link != nil ? .isLink : [])
    }
}
