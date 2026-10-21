import SwiftUI
import CodeIslandCore

// Shared pieces of the goal notch (Figma A2 «Vetro smerigliato»): what a goal's state reads as,
// its colour, and the bar and ring that draw its proofs. Copy is plain Italian literals (L10n has no
// Italian table); app-copy rules.

extension GoalRow {
    /// A2's colours: yellow while work is under way, green once reached or every proof is done,
    /// red when blocked, grey when still or only proposed. Colour is never the only signal: the
    /// status word (`statusText`) always goes with it.
    var color: Color {
        if proposed { return GoalInk.secondary }
        switch status {
        case .reached: return GoalTone.go.color
        case .blocked: return GoalTone.stop.color
        case .still: return GoalInk.secondary
        case .moving: return proofsTotal > 0 && proofsDone == proofsTotal ? GoalTone.go.color : GoalTone.wait.color
        }
    }

    /// The status label (app-copy: adjective or participle, no verbs).
    func statusText(now: Date) -> String {
        if proposed { return "Proposto" }
        switch status {
        case .moving: return "In corso"
        case .still(let since): return "Fermo da " + Self.elapsed(from: since, to: now)
        case .blocked: return "Bloccato"
        case .reached: return "Raggiunto"
        }
    }

    /// The register's reason for a blocked goal, without its "BLOCCATO:" prefix.
    var blockedReason: String? {
        guard case .blocked(let reason) = status else { return nil }
        var text = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.uppercased().hasPrefix("BLOCCATO:") { text = String(text.dropFirst(9)).trimmingCharacters(in: .whitespaces) }
        return text.isEmpty ? nil : text
    }

    /// The goal text under the title, unless the title already is it.
    var hasSubtitle: Bool { !goal.isEmpty && goal != title }
    var runningCount: Int { pulses.filter { $0.running }.count }

    var sessionsText: String {
        let n = runningCount
        return n == 0 ? "Nessuna sessione al lavoro" : "\(n) \(n == 1 ? "sessione" : "sessioni") al lavoro"
    }

    var proofsText: String? { proofsTotal > 0 ? "\(proofsDone)/\(proofsTotal)" : nil }
    var proofsSentence: String { proofsTotal > 0 ? "\(proofsDone) prove su \(proofsTotal)" : "Nessuna prova dichiarata" }

    static func elapsed(from start: Date, to end: Date) -> String {
        let minutes = max(1, Int(end.timeIntervalSince(start) / 60))
        if minutes < 60 { return "\(minutes) min" }
        if minutes < 24 * 60 { return "\(minutes / 60) h" }
        return "\(minutes / (24 * 60)) g"
    }

    /// «Dalle 13:44» today, «Dal 20 ott» before.
    var sinceText: String? {
        guard let since else { return nil }
        return Calendar.current.isDateInToday(since)
            ? "Dalle " + since.formatted(.dateTime.hour().minute())
            : "Dal " + since.formatted(.dateTime.day().month(.abbreviated))
    }

    func accessibilityText(now: Date) -> String {
        var parts = [title]
        if hasSubtitle { parts.append(goal) }
        parts.append(proofsSentence)
        parts.append(statusText(now: now))
        if let blockedReason { parts.append(blockedReason) }
        parts.append(sessionsText)
        return parts.joined(separator: ". ")
    }
}

extension Array where Element == GoalRow {
    /// The goal being chased now (`GoalBoard.chased`).
    var hero: GoalRow? { GoalBoard.chased(self) }
    /// The chased goal first, then GoalBoard's order: the order of the rings and of the goal pages.
    var heroFirst: [GoalRow] {
        guard let hero else { return self }
        return [hero] + filter { $0.id != hero.id }
    }

    func accessibilitySummary(now: Date) -> String {
        guard let hero else { return "Nessun obiettivo aperto" }
        return hero.accessibilityText(now: now)
    }
}

// MARK: - Bar and ring

/// Fill = declared proofs done / declared proofs, or an account's usage. `nil` draws the bare track:
/// never an invented fill.
struct GoalBar: View {
    let progress: Double?
    let color: Color
    var height: CGFloat = 4
    var vertical = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            let length = vertical ? geo.size.height : geo.size.width
            // Never shorter than thick, so a first proof reads as a bar, not a dot.
            let fill = progress.map { $0 > 0 ? max(height, length * CGFloat(Swift.min($0, 1))) : 0 } ?? 0
            ZStack(alignment: vertical ? .bottom : .leading) {
                Capsule().fill(GoalInk.track)
                Capsule().fill(color)
                    .frame(width: vertical ? nil : fill, height: vertical ? fill : nil)
            }
        }
        .frame(width: vertical ? height : nil, height: vertical ? nil : height)
        .animation(NotchMotion.spring(reduced: reduceMotion), value: progress)
    }
}

/// A goal's proofs as a ring: the arc is the share done; no declared proofs is the bare track.
struct GoalRing: View {
    let row: GoalRow
    var size: CGFloat = 13
    var line: CGFloat = 2
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var share: Double {
        if case .reached = row.status { return 1 }
        return row.progress ?? 0
    }

    var body: some View {
        ZStack {
            Circle().stroke(GoalInk.track, lineWidth: line)
            Circle()
                .trim(from: 0, to: share)
                .stroke(row.color, style: StrokeStyle(lineWidth: line, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .padding(line / 2)
        .frame(width: size, height: size)
        .animation(NotchMotion.spring(reduced: reduceMotion), value: share)
    }
}

/// A status word on a wash of its own colour («In corso»).
struct StatusPill: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(NotchType.label)
            .foregroundStyle(color)
            .lineLimit(1)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Capsule().fill(color.opacity(0.18)))
    }
}

/// Page dots: the current one long and bright.
struct PageDots: View {
    let count: Int
    let current: Int

    var body: some View {
        if count > 1 {
            HStack(spacing: 6) {
                ForEach(0..<count, id: \.self) { i in
                    Capsule()
                        .fill(Color.white.opacity(i == current ? 0.9 : 0.3))
                        .frame(width: 14, height: 3)
                }
            }
            .accessibilityHidden(true)
        }
    }
}
