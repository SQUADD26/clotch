import SwiftUI
import CodeIslandCore

// The notch shows goals only: one row per open goal, read from GoalStore.
// Copy is plain Italian literals (L10n has no Italian table); app-copy rules.

// MARK: - Tone (traffic light)

/// The three colours of the traffic light: Apple's dark-appearance system green, yellow and red,
/// so they sit on the black notch like the Dynamic Island's own tints (all above 4.5:1 on black).
enum GoalTone {
    case go, wait, stop

    var color: Color {
        switch self {
        case .go: return Color(red: 48 / 255, green: 209 / 255, blue: 88 / 255)
        case .wait: return Color(red: 1, green: 214 / 255, blue: 10 / 255)
        case .stop: return Color(red: 1, green: 69 / 255, blue: 58 / 255)
        }
    }
}

/// Text levels on black. Secondary stays at 0.62 so 11pt text keeps AA contrast.
enum GoalInk {
    static let primary = Color.white.opacity(0.94)
    static let secondary = Color.white.opacity(0.62)
    static let track = Color.white.opacity(0.14)
}

extension GoalRow {
    var tone: GoalTone {
        switch status {
        case .moving, .reached: return .go
        case .still: return .wait
        case .blocked: return .stop
        }
    }

    /// Shape for the state, so colour is never the only signal: play, pause, stop, done.
    var symbol: String {
        switch status {
        case .moving: return "play.fill"
        case .still: return "pause.fill"
        case .blocked: return "stop.fill"
        case .reached: return "checkmark"
        }
    }

    var displayTitle: String { title.isEmpty ? goal : title }
    var runningCount: Int { pulses.filter { $0.running }.count }

    var sessionsText: String {
        let n = pulses.count
        return "\(n) \(n == 1 ? "sessione attiva" : "sessioni attive"), \(runningCount) in corso"
    }

    var proofsText: String? { proofsTotal > 0 ? "\(proofsDone)/\(proofsTotal)" : nil }

    /// The one line shown only when the goal is not green.
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
            return text.isEmpty ? "Bloccato" : text
        }
    }

    static func elapsed(from start: Date, to end: Date) -> String {
        let minutes = max(1, Int(end.timeIntervalSince(start) / 60))
        if minutes < 60 { return "\(minutes) min" }
        if minutes < 24 * 60 { return "\(minutes / 60) h" }
        return "\(minutes / (24 * 60)) g"
    }

    func accessibilityText(now: Date) -> String {
        var parts = [displayTitle]
        if !title.isEmpty { parts.append(goal) }
        if proofsTotal > 0 { parts.append("\(proofsDone) prove su \(proofsTotal)") } else { parts.append("Nessuna prova dichiarata") }
        if case .reached = status { parts.append("Raggiunto") }
        else if let r = reason(now: now) { parts.append(r) }
        else { parts.append("In corso") }
        if !pulses.isEmpty { parts.append(sessionsText) }
        return parts.joined(separator: ". ")
    }
}

extension Array where Element == GoalRow {
    /// The goal being chased now: the open one with the latest activity. The rest keep GoalBoard's
    /// order (blocked, then still, then moving), so trouble stays on top right under it.
    var hero: GoalRow? {
        filter { if case .reached = $0.status { return false } else { return true } }
            .max { ($0.lastActivity ?? .distantPast) < ($1.lastActivity ?? .distantPast) } ?? first
    }
    var allPulses: [GoalPulse] { flatMap(\.pulses) }

    func accessibilitySummary(now: Date) -> String {
        guard let hero else { return "Nessun obiettivo aperto" }
        return hero.accessibilityText(now: now)
    }
}

// MARK: - Bar

/// Fill = declared proofs done / declared proofs. `nil` draws the bare track: never an invented fill.
/// The same bar draws account usage, with its own colour.
struct GoalBar: View {
    let progress: Double?
    let color: Color
    let height: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(progress: Double?, tone: GoalTone, height: CGFloat) {
        self.init(progress: progress, color: tone.color, height: height)
    }

    init(progress: Double?, color: Color, height: CGFloat) {
        self.progress = progress
        self.color = color
        self.height = height
    }

    var body: some View {
        let motion: Animation? = reduceMotion ? nil : NotchAnimation.close
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(GoalInk.track)
                if let progress, progress > 0 {
                    // Never narrower than tall, so a first proof reads as a bar, not a dot.
                    Capsule()
                        .fill(color)
                        .frame(width: max(height, geo.size.width * CGFloat(min(progress, 1))))
                }
            }
        }
        .frame(height: height)
        .animation(motion, value: progress)
        .animation(motion, value: color)
    }
}

// MARK: - Sessions

/// One thin tick per active session (capped), the number beside it is the true count.
/// Running ticks move, idle ones stay dim: `bounce` moves them in height, otherwise they breathe in opacity.
/// The resting frame is the full bright tick, so a still render (snapshot, reduce motion) is honest.
struct SessionTicks: View {
    let pulses: [GoalPulse]
    var cap = 5
    var height: CGFloat = 11
    var bounce = false
    @State private var moving = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 2) {
            ForEach(Array(pulses.prefix(cap).enumerated()), id: \.element.id) { i, pulse in
                let live = pulse.running && !reduceMotion
                Capsule()
                    .fill(Color.white)
                    .frame(width: 2, height: height)
                    .opacity(pulse.running ? (live && moving && !bounce ? 0.45 : 0.95) : 0.3)
                    .scaleEffect(x: 1, y: live && moving && bounce ? 0.4 : 1, anchor: .bottom)
                    // Staggered periods so several running sessions never move in lockstep; under 2 s (HIG).
                    .animation(live ? Animation.easeInOut(duration: (bounce ? 0.5 : 1.6) + Double(i) * 0.12)
                        .repeatForever(autoreverses: true) : nil, value: moving)
            }
        }
        .onAppear { moving = true }
        .accessibilityHidden(true)
    }
}

/// Ticks plus the count, the "how many sessions" cluster every direction uses.
struct SessionCount: View {
    let pulses: [GoalPulse]
    var cap = 5
    var bounce = false
    var size: CGFloat = 12

    var body: some View {
        if !pulses.isEmpty {
            HStack(spacing: 5) {
                SessionTicks(pulses: pulses, cap: cap, height: size - 1, bounce: bounce)
                Text("\(pulses.count)")
                    .font(.system(size: size, weight: .semibold).monospacedDigit())
                    .foregroundStyle(GoalInk.primary)
                    .contentTransition(.numericText())
            }
            .fixedSize()
        }
    }
}

/// The state shape plus the reason, in the tone colour. Shown only when the goal is not green.
struct GoalReason: View {
    let row: GoalRow
    let now: Date
    var size: CGFloat = 11.5

    var body: some View {
        if let reason = row.reason(now: now) {
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Image(systemName: row.symbol).font(.system(size: size - 3, weight: .bold))
                Text(reason).font(.system(size: size, weight: .medium)).lineLimit(1).truncationMode(.tail)
            }
            .foregroundStyle(row.tone.color)
        }
    }
}
