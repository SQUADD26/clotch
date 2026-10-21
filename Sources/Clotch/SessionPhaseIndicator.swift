import SwiftUI
import ClotchCore

// The indicator of a session's true state (clotch#114): one mark per phase of the engine's contract.
// Colour and wording come from `SessionPhase` (Core, tested); this file only draws them.

extension Color {
    init(_ c: RGB) { self.init(red: Double(c.r) / 255, green: Double(c.g) / 255, blue: Double(c.b) / 255) }
}

/// Which sessions Roberto opened, and when: a session waiting for him pulses until he opens it. In memory only,
/// so a restart pulses again for what still waits, which is the safe side.
final class SessionSeen: ObservableObject {
    static let shared = SessionSeen()
    @Published private var opened: [String: Date] = [:]

    func markOpened(_ localId: String) { opened[localId] = Date() }

    /// Waiting for Roberto, and not opened since it started waiting.
    func needsEye(_ row: GoalRow) -> Bool {
        guard row.phase.pulses, !row.proposed else { return false }
        guard let id = row.master?.localId, let at = opened[id] else { return true }
        return at < (row.motor?.since ?? .distantPast)
    }
}

/// «In lavorazione» in two drawings, to choose with Roberto: `ping` a dot with a ring that spreads and fades,
/// `bars` three bars that rise and fall. Pick with `defaults write com.squadd.clotch clotch.workingStyle bars`.
enum WorkingStyle: String, CaseIterable {
    case ping, bars
    static var current: WorkingStyle {
        UserDefaults.standard.string(forKey: "clotch.workingStyle").flatMap(Self.init(rawValue:)) ?? .ping
    }
}

/// The mark of a row: it observes `SessionSeen`, so the pulse stops the moment the session is opened.
struct RowPhase: View {
    let row: GoalRow
    var size: CGFloat = 14
    var compact = false
    @ObservedObject private var seen = SessionSeen.shared

    var body: some View {
        PhaseIndicator(phase: row.phase, pulsing: seen.needsEye(row), size: size, compact: compact)
    }
}

struct PhaseIndicator: View {
    let phase: SessionPhase
    var pulsing = false
    var size: CGFloat = 14
    /// A small dot only, for the closed notch's rings.
    var compact = false
    var style = WorkingStyle.current
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var color: Color { Color(phase.rgb) }

    var body: some View {
        Group {
            if compact { dot } else {
                switch phase {
                case .lavora: working
                case .aspettaRoberto: dot
                case .aspettaAltro: Image(systemName: "hourglass").font(.system(size: size * 0.8, weight: .semibold))
                case .ferma: Image(systemName: "pause.fill").font(.system(size: size * 0.7, weight: .semibold))
                case .problema: Image(systemName: "exclamationmark.triangle.fill").font(.system(size: size * 0.85, weight: .semibold))
                }
            }
        }
        .foregroundStyle(color)
        .frame(width: size, height: size)
        .accessibilityHidden(true)  // the row's label already says the state
    }

    /// Solid dot; a working one ripples, one waiting for Roberto breathes while `pulsing`. Reduce Motion: no ripple,
    /// a waiting one keeps a still halo.
    private var dot: some View {
        let moving = !reduceMotion && (phase.animates || pulsing)
        return TimelineView(.animation(minimumInterval: 1 / 30, paused: !moving)) { ctx in
            let t = ctx.date.timeIntervalSinceReferenceDate
            let wave = moving ? ripple(t, period: phase.animates ? 1.6 : 1.2) : 0.5
            let halo = moving ? 0.7 * (1 - wave) : (phase.pulses ? 0.35 : 0)
            ZStack {
                Circle().stroke(color.opacity(halo), lineWidth: max(1, size * 0.1)).scaleEffect(0.4 + 0.6 * wave)
                Circle().fill(color).frame(width: size * 0.4, height: size * 0.4)
            }
        }
    }

    /// 0…1, repeating: the ring's progress.
    private func ripple(_ t: TimeInterval, period: TimeInterval) -> Double {
        t.truncatingRemainder(dividingBy: period) / period
    }

    @ViewBuilder private var working: some View {
        switch style {
        case .ping: dot
        case .bars:
            TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { ctx in
                let t = ctx.date.timeIntervalSinceReferenceDate
                HStack(alignment: .center, spacing: size * 0.12) {
                    ForEach(0..<3, id: \.self) { i in
                        let level = reduceMotion ? 0.7 : 0.35 + 0.65 * abs(sin(t * 4.2 + Double(i) * 1.1))
                        Capsule().fill(color).frame(width: size * 0.2, height: size * level)
                    }
                }
            }
        }
    }
}
