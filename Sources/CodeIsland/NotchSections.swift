import SwiftUI
import CodeIslandCore

/// The open notch: three glass plates in Roberto's order (accounts, the goal chased now, his
/// requests). 8pt inset and 16pt plates: concentric with the island's 24pt bottom corners.
struct NotchSections: View {
    let maxHeight: CGFloat
    @ObservedObject private var store = GoalStore.shared
    @State private var contentHeight: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            NotchSectionsContent(rows: store.rows, usage: store.usage, requests: store.requests, now: store.now)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
        }
        .frame(height: min(contentHeight, maxHeight))
        .animation(reduceMotion ? nil : NotchAnimation.close, value: contentHeight)
    }
}

/// The plates without the scroll view: `--snapshot` draws this (ImageRenderer skips ScrollView content).
struct NotchSectionsContent: View {
    let rows: [GoalRow]
    let usage: [AccountUsage]
    let requests: [UserRequest]
    let now: Date

    var body: some View {
        GlassGroup(spacing: 8) {
            VStack(spacing: 8) {
                UsagePlate(usage: usage, now: now)
                GoalPlate(rows: rows, now: now)
                RequestsPlate(requests: requests)
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 2)
        .padding(.bottom, 8)
    }
}

private struct PlateTitle: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text).font(.system(size: 11, weight: .semibold)).foregroundStyle(GoalInk.secondary)
    }
}

private struct EmptyLine: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text).font(.system(size: 12, weight: .medium)).foregroundStyle(GoalInk.secondary)
    }
}

// MARK: - Accounts

private struct UsagePlate: View {
    let usage: [AccountUsage]
    let now: Date
    static let meter: CGFloat = 128

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                PlateTitle("Account").frame(maxWidth: .infinity, alignment: .leading)
                if !usage.isEmpty {
                    PlateTitle("5 ore").frame(width: Self.meter, alignment: .leading)
                    PlateTitle("Settimana").frame(width: Self.meter, alignment: .leading)
                }
            }
            if usage.isEmpty { EmptyLine("Nessun dato sull'uso") }
            ForEach(usage) { AccountLine(account: $0, now: now) }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassPlate(radius: 16)
    }
}

private struct AccountLine: View {
    let account: AccountUsage
    let now: Date

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 1) {
                Text(account.email ?? "Account \(account.id.prefix(8))")
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(GoalInk.primary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                if let note { Text(note).font(.system(size: 11)).foregroundStyle(GoalInk.secondary).lineLimit(1) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if account.expired {
                Label("Login scaduto", systemImage: "pause.fill")
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(GoalTone.wait.color)
                    .frame(width: UsagePlate.meter * 2 + 12, alignment: .leading)
            } else {
                UsageMeter(window: account.fiveHour, now: now).frame(width: UsagePlate.meter)
                UsageMeter(window: account.sevenDay, now: now).frame(width: UsagePlate.meter)
            }
        }
        .accessibilityElement(children: .combine)
    }

    /// Why the numbers are missing, or how old they are: real data says its age.
    private var note: String? {
        if account.fiveHour == nil, account.sevenDay == nil, let reason = account.reason, !reason.isEmpty { return reason }
        guard let at = account.at, now.timeIntervalSince(at) > 15 * 60 else { return nil }
        return "Aggiornato " + GoalRow.elapsed(from: at, to: now) + " fa"
    }
}

private struct UsageMeter: View {
    let window: UsageWindow?
    let now: Date

    /// A window whose reset is past counts as 0% used (claude-accounts reads it the same way).
    private var used: Double? {
        guard let window else { return nil }
        if let reset = window.reset, reset < now { return 0 }
        return min(max(window.used, 0), 100)
    }

    /// Plenty left is plain white; the colour only warns.
    private var color: Color {
        guard let used else { return GoalInk.secondary }
        return used >= 90 ? GoalTone.stop.color : used >= 70 ? GoalTone.wait.color : Color.white.opacity(0.85)
    }

    var body: some View {
        HStack(spacing: 8) {
            GoalBar(progress: used.map { $0 / 100 }, color: color, height: 4)
            Text(used.map { "\(Int($0.rounded()))%" } ?? "–")
                .font(.system(size: 11.5, weight: .semibold).monospacedDigit())
                .foregroundStyle(used == nil ? GoalInk.secondary : GoalInk.primary)
                .frame(width: 36, alignment: .trailing)
                .contentTransition(.numericText())
        }
    }
}

// MARK: - Goals

private struct GoalPlate: View {
    let rows: [GoalRow]
    let now: Date

    var body: some View {
        let hero = rows.hero
        let others = rows.filter { $0.id != hero?.id }
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                PlateTitle("Obiettivo")
                Spacer(minLength: 8)
                if let hero { SessionCount(pulses: hero.pulses, size: 11.5).help(hero.sessionsText) }
            }
            if let hero { HeroGoal(row: hero, now: now) } else { EmptyLine("Nessun obiettivo aperto") }
            if !others.isEmpty {
                Rectangle().fill(Color.white.opacity(0.1)).frame(height: 0.5).padding(.vertical, 2)
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(others) { OtherGoal(row: $0, now: now) }
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        // The plate takes the goal's traffic light as a faint tint: state, not decoration.
        .glassPlate(radius: 16, tint: hero?.tone.color.opacity(0.16))
    }
}

private struct HeroGoal: View {
    let row: GoalRow
    let now: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(row.displayTitle)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(GoalInk.primary)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if row.proofsTotal > 0 {
                    HStack(alignment: .firstTextBaseline, spacing: 1) {
                        Text("\(row.proofsDone)")
                            .font(.system(size: 26, weight: .semibold, design: .rounded).monospacedDigit())
                            .foregroundStyle(GoalInk.primary)
                            .contentTransition(.numericText())
                        Text("/\(row.proofsTotal)")
                            .font(.system(size: 14, weight: .medium, design: .rounded).monospacedDigit())
                            .foregroundStyle(GoalInk.secondary)
                    }
                    .fixedSize()
                } else {
                    Text("Nessuna prova").font(.system(size: 11.5, weight: .medium)).foregroundStyle(GoalInk.secondary).fixedSize()
                }
            }
            if !row.title.isEmpty {
                Text(row.goal).font(.system(size: 12)).foregroundStyle(GoalInk.secondary).lineLimit(2)
            }
            GoalBar(progress: row.progress, tone: row.tone, height: 8).padding(.top, 2)
            GoalReason(row: row, now: now, size: 12)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(row.accessibilityText(now: now))
    }
}

private struct OtherGoal: View {
    let row: GoalRow
    let now: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 10) {
                Image(systemName: row.symbol)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(row.tone.color)
                    .frame(width: 12)
                Text(row.displayTitle)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(GoalInk.primary)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                GoalBar(progress: row.progress, tone: row.tone, height: 4).frame(width: 96)
                Text(row.proofsText ?? "–")
                    .font(.system(size: 11.5, weight: .medium).monospacedDigit())
                    .foregroundStyle(GoalInk.secondary)
                    .frame(width: 30, alignment: .trailing)
                SessionCount(pulses: row.pulses, cap: 3, size: 11).frame(width: 34, alignment: .trailing)
            }
            if let reason = row.reason(now: now) {
                Text(reason)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(row.tone.color)
                    .lineLimit(1)
                    .padding(.leading, 22)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(row.accessibilityText(now: now))
    }
}

// MARK: - Requests

private struct RequestsPlate: View {
    let requests: [UserRequest]
    private static let shown = 6

    var body: some View {
        // Waiting first, then the ones taken in charge; newest first in each (GoalStore's order).
        let ordered = requests.filter { !$0.taken } + requests.filter(\.taken)
        let pending = requests.count - requests.filter(\.taken).count
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                PlateTitle("Richieste")
                Spacer(minLength: 8)
                if pending > 0 {
                    Text("\(pending) in attesa").font(.system(size: 11, weight: .medium)).foregroundStyle(GoalInk.secondary)
                }
            }
            if requests.isEmpty { EmptyLine("Nessuna richiesta") }
            ForEach(ordered.prefix(Self.shown)) { RequestLine(request: $0) }
            if ordered.count > Self.shown {
                Text("Altre \(ordered.count - Self.shown)")
                    .font(.system(size: 11))
                    .foregroundStyle(GoalInk.secondary)
                    .padding(.leading, 19)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassPlate(radius: 16)
    }
}

private struct RequestLine: View {
    let request: UserRequest

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Image(systemName: request.taken ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(request.taken ? GoalTone.go.color : GoalInk.secondary)
                .frame(width: 11)
            Text(request.text)
                .font(.system(size: 12, weight: request.taken ? .regular : .medium))
                .strikethrough(request.taken, color: GoalInk.secondary)
                .foregroundStyle(request.taken ? GoalInk.secondary : GoalInk.primary)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let at = request.takenAt ?? request.at {
                Text(Self.time(at))
                    .font(.system(size: 11).monospacedDigit())
                    .foregroundStyle(GoalInk.secondary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(request.text + (request.taken ? ". Presa in carico" : ". In attesa"))
    }

    static func time(_ date: Date) -> String {
        Calendar.current.isDateInToday(date)
            ? date.formatted(.dateTime.hour().minute())
            : date.formatted(.dateTime.day().month(.abbreviated))
    }
}
