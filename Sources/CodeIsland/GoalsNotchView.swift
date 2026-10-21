import SwiftUI
import CodeIslandCore

// The notch shows goals only: one row per open goal, read from GoalStore.
// Copy is plain Italian literals (L10n has no Italian table); app-copy rules.

// MARK: - Tone (traffic light)

/// The three colours of the traffic light. Calm system-like hues, legible on black.
enum GoalTone {
    case go, wait, stop

    var color: Color {
        switch self {
        case .go: return Color(red: 0.35, green: 0.80, blue: 0.50)
        case .wait: return Color(red: 0.96, green: 0.72, blue: 0.28)
        case .stop: return Color(red: 0.96, green: 0.40, blue: 0.38)
        }
    }
}

extension GoalRow {
    var tone: GoalTone {
        switch status {
        case .moving, .reached: return .go
        case .still: return .wait
        case .blocked: return .stop
        }
    }

    var runningCount: Int { pulses.filter { $0.running }.count }

    var sessionsText: String {
        let n = pulses.count
        return "\(n) \(n == 1 ? "sessione attiva" : "sessioni attive"), \(runningCount) in corso"
    }

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
        var parts = [title.isEmpty ? goal : title]
        if !title.isEmpty { parts.append(goal) }
        if proofsTotal > 0 { parts.append("\(proofsDone) prove su \(proofsTotal)") } else { parts.append("Nessuna prova dichiarata") }
        if case .reached = status { parts.append("Raggiunto") }
        else if let r = reason(now: now) { parts.append(r) }
        else { parts.append("In corso") }
        if !pulses.isEmpty { parts.append(sessionsText) }
        return parts.joined(separator: ". ")
    }
}

// MARK: - Bar

/// Fill = declared proofs done / declared proofs. `nil` draws the bare track: never an invented fill.
struct GoalBar: View {
    let progress: Double?
    let tone: GoalTone
    let height: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let motion: Animation? = reduceMotion ? nil : NotchAnimation.close
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.12))
                if let progress, progress > 0 {
                    // Never narrower than tall, so a first proof reads as a bar, not a dot.
                    Capsule()
                        .fill(tone.color)
                        .frame(width: max(height, geo.size.width * CGFloat(min(progress, 1))))
                }
            }
        }
        .frame(height: height)
        .animation(motion, value: progress)
        .animation(motion, value: tone)
    }
}

// MARK: - Pulse

/// One thin tick per active session; running ones breathe slowly in opacity.
private struct PulseTicks: View {
    let pulses: [GoalPulse]
    @State private var inhale = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private func tickOpacity(_ pulse: GoalPulse) -> Double {
        guard pulse.running else { return 0.22 }
        return reduceMotion || inhale ? 0.95 : 0.4
    }

    var body: some View {
        let breathe: Animation? = reduceMotion ? nil : Animation.easeInOut(duration: 1.8).repeatForever(autoreverses: true)
        HStack(spacing: 2.5) {
            // shortcut: caps the ticks at 6, the number beside them stays the true count.
            ForEach(Array(pulses.prefix(6))) { pulse in
                RoundedRectangle(cornerRadius: 1, style: .continuous)
                    .fill(Color.white)
                    .frame(width: 2, height: 11)
                    .opacity(tickOpacity(pulse))
            }
        }
        .animation(breathe, value: inhale)
        .onAppear { inhale = true }
    }
}

// MARK: - Row

private struct GoalRowView: View {
    let row: GoalRow
    let now: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.title.isEmpty ? row.goal : row.title)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color.white.opacity(0.92))
                        .lineLimit(1)
                        .truncationMode(.tail)
                    if !row.title.isEmpty {
                        Text(row.goal)
                            .font(.system(size: 11))
                            .foregroundStyle(Color.white.opacity(0.55))
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if !row.pulses.isEmpty {
                    HStack(spacing: 7) {
                        PulseTicks(pulses: row.pulses)
                        Text("\(row.pulses.count)")
                            .font(.system(size: 12, weight: .medium).monospacedDigit())
                            .foregroundStyle(Color.white.opacity(0.7))
                    }
                    .fixedSize()
                    .help(row.sessionsText)
                }
            }
            HStack(spacing: 10) {
                GoalBar(progress: row.progress, tone: row.tone, height: 4)
                if row.progress == nil {
                    Text("Nessuna prova dichiarata")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.white.opacity(0.45))
                        .fixedSize()
                } else if row.proofsTotal > 0 {
                    Text("\(row.proofsDone)/\(row.proofsTotal)")
                        .font(.system(size: 11, weight: .medium).monospacedDigit())
                        .foregroundStyle(Color.white.opacity(0.6))
                        .fixedSize()
                }
            }
            if let reason = row.reason(now: now) {
                Text(reason)
                    .font(.system(size: 11))
                    .foregroundStyle(row.tone.color)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(row.accessibilityText(now: now))
    }
}

// MARK: - Expanded list

/// The rows without the scroll view: the expanded list uses it, and so does `--snapshot`
/// (ImageRenderer does not draw ScrollView content).
struct GoalRowsList: View {
    let rows: [GoalRow]
    let now: Date

    var body: some View {
        VStack(spacing: 18) {
            ForEach(rows) { row in
                GoalRowView(row: row, now: now)
            }
        }
        .padding(.horizontal, 22)
        .padding(.top, 14)
        .padding(.bottom, 18)
    }
}

struct GoalsEmptyState: View {
    var body: some View {
        Text("Nessun obiettivo aperto")
            .font(.system(size: 12))
            .foregroundStyle(Color.white.opacity(0.5))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 22)
            .padding(.vertical, 18)
    }
}


/// The whole expanded body: replaces the session list. Scrolls inside `maxHeight`.
struct GoalsNotchView: View {
    let maxHeight: CGFloat
    @ObservedObject private var store = GoalStore.shared
    @State private var contentHeight: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var listHeight: CGFloat { min(contentHeight, maxHeight) }

    var body: some View {
        let motion: Animation? = reduceMotion ? nil : NotchAnimation.close
        if store.rows.isEmpty {
            GoalsEmptyState()
        } else {
            ScrollView(.vertical, showsIndicators: false) {
                GoalRowsList(rows: store.rows, now: store.now)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
            }
            .frame(height: listHeight)
            .animation(motion, value: listHeight)
            .animation(motion, value: store.rows.map { $0.id })
        }
    }
}
