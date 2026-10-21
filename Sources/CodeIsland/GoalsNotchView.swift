import AppKit
import SwiftUI
import CodeIslandCore

// The notch shows goals: one page per open goal, read from GoalStore.
// Copy is plain Italian literals (L10n has no Italian table); app-copy rules.

extension GoalRow {
    var tone: GoalTone {
        switch status {
        case .moving, .reached: return .go
        case .still: return .wait
        case .blocked: return .stop
        }
    }

    /// A proposed goal is drawn quiet: grey, never a traffic light.
    var ink: Color { proposed ? GoalInk.secondary : tone.color }
    /// The ring and the proofs count: coloured by the share of proofs done (Figma thresholds), never by state.
    var ringInk: Color {
        guard !proposed, let p = progress else { return GoalInk.secondary }
        return p >= 0.75 ? GoalTone.go.color : p >= 0.4 ? GoalTone.wait.color : GoalTone.stop.color
    }
    var runningCount: Int { pulses.filter { $0.running }.count }

    /// The state as a label (app-copy: adjective or participle).
    var statusLabel: String {
        if proposed { return "Proposto" }
        switch status {
        case .moving: return "In corso"
        case .still: return "Fermo"
        case .blocked: return "Bloccato"
        case .reached: return "Raggiunto"
        }
    }

    /// The goal text under the title, unless the title already is it.
    var hasSubtitle: Bool { !goal.isEmpty && goal != title }

    var sessionsText: String {
        let n = runningCount
        if n == 0 { return "Nessuna sessione al lavoro" }
        return "\(n) \(n == 1 ? "sessione" : "sessioni") al lavoro"
    }

    var proofsText: String? { proofsTotal > 0 ? "\(proofsDone)/\(proofsTotal)" : nil }
    var proofsSentence: String { proofsTotal > 0 ? "\(proofsDone) prove su \(proofsTotal)" : "Nessuna prova dichiarata" }

    /// The master session chasing the goal, opened in the Claude app; nil when it has none.
    var masterLink: URL? {
        pulses.first { $0.kind == .master }.flatMap { ClaudeDesktopCodeSession.deepLinkURL(hostSessionId: $0.id) }
    }

    /// When work stopped: a still goal's counter stops at the moment it went still, it does not keep counting.
    var workEnd: Date? {
        if case .still(let at) = status { return at }
        return nil
    }

    /// Why the goal is not green, when it is not: shown under its text.
    func reason(now: Date) -> String? {
        switch status {
        case .moving, .reached:
            return nil
        case .still(let since):
            return "Fermo da " + Self.elapsed(from: since, to: now)
        case .blocked(let reason):
            var text = reason.trimmingCharacters(in: .whitespacesAndNewlines)
            // The register stores the reason as "BLOCCATO: …".
            if text.uppercased().hasPrefix("BLOCCATO:") { text = String(text.dropFirst(9)).trimmingCharacters(in: .whitespaces) }
            return text.isEmpty ? nil : text
        }
    }

    static func elapsed(from start: Date, to end: Date) -> String {
        let minutes = max(1, Int(end.timeIntervalSince(start) / 60))
        if minutes < 60 { return "\(minutes) min" }
        if minutes < 24 * 60 { return "\(minutes / 60) h" }
        return "\(minutes / (24 * 60)) g"
    }

    /// Work time as a clock, «2:04:17»; hours keep counting past a day.
    static func clock(from start: Date, to end: Date) -> String {
        let s = max(0, Int(end.timeIntervalSince(start)))
        return String(format: "%d:%02d:%02d", s / 3600, s / 60 % 60, s % 60)
    }

    func accessibilityText(now: Date) -> String {
        var parts = [title]
        if hasSubtitle { parts.append(goal) }
        parts.append(statusLabel)
        parts.append(proofsSentence)
        if let r = reason(now: now) { parts.append(r) }
        parts.append(sessionsText)
        return parts.joined(separator: ". ")
    }
}

extension Array where Element == GoalRow {
    /// The goal being chased now (`GoalBoard.chased`). The rest keep GoalBoard's
    /// order (blocked, then still, then moving), so trouble stays on top right under it.
    var hero: GoalRow? { GoalBoard.chased(self) }

    /// The pages of the open notch and the rings of the closed one: the goal chased now first.
    var pages: [GoalRow] {
        guard let hero else { return self }
        return [hero] + filter { $0.id != hero.id }
    }

    func accessibilitySummary(now: Date) -> String {
        guard let hero else { return "Nessun obiettivo aperto" }
        return hero.accessibilityText(now: now)
    }
}

// MARK: - Bar

/// Fill = progress. `nil` draws the bare track: never an invented fill. Account usage uses it too.
struct GoalBar: View {
    let progress: Double?
    let color: Color
    let height: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(GoalInk.track)
                if let progress, progress > 0 {
                    // Never narrower than tall, so a first step reads as a bar, not a dot.
                    Capsule()
                        .fill(color)
                        .frame(width: max(height, geo.size.width * CGFloat(Swift.min(progress, 1))))
                }
            }
        }
        .frame(height: height)
        .animation(NotchMotion.animation(reduce: reduceMotion), value: progress)
    }
}

// MARK: - Ring

/// A goal as a ring: the track, and the arc of declared proofs done in the goal's colour.
/// No declared proofs: only a thin outline. Used large on the goal page and small in the closed notch.
struct GoalRing: View {
    let progress: Double?
    let color: Color
    let size: CGFloat
    let line: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            if progress == nil {
                Circle().stroke(GoalInk.bare, lineWidth: 1.4)
            } else {
                Circle().stroke(GoalInk.ringTrack, lineWidth: line)
            }
            Circle()
                .trim(from: 0, to: CGFloat(min(progress ?? 0, 1)))
                .stroke(color, style: StrokeStyle(lineWidth: line, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .padding(line / 2)
        .frame(width: size, height: size)
        .animation(NotchMotion.animation(reduce: reduceMotion), value: progress)
    }
}

extension GoalRing {
    init(row: GoalRow, size: CGFloat, line: CGFloat) {
        self.init(progress: row.progress, color: row.ringInk, size: size, line: line)
    }
}

// MARK: - Work time

/// «2:04:17» since the goal took its present text. Ticks once a second, and only while it is on
/// screen (TimelineView): the closed notch never shows it, so it costs nothing at rest. With `until`
/// (work stopped) it is a fixed figure and no clock runs.
struct WorkTimer: View {
    let since: Date
    var until: Date? = nil

    var body: some View {
        if let until {
            figure(until)
        } else {
            TimelineView(.periodic(from: .now, by: 1)) { ctx in figure(ctx.date) }
        }
    }

    private func figure(_ end: Date) -> some View {
        Text(GoalRow.clock(from: since, to: end))
            .font(NotchType.timer)
            .tracking(0.24)
            .foregroundStyle(GoalInk.row)
    }
}

/// A small icon + text pair: «⌘ 2 sessioni al lavoro», «◎ Obiettivo 1 di 4».
struct IconLabel: View {
    let symbol: String
    let text: String
    var font: Font = NotchType.label
    var color: Color = GoalInk.secondary

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: symbol).font(font)
            Text(text).font(font).lineLimit(1)
        }
        .foregroundStyle(color)
    }
}

/// The state in its colour, as a pill: «In corso».
struct StatusPill: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(NotchType.smallEmphasis)
            .foregroundStyle(color)
            .padding(.horizontal, 9)
            .frame(height: 20)
            .background(Capsule().fill(color.opacity(0.16)))
    }
}
