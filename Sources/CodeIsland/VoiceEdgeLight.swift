import SwiftUI
import CodeIslandCore

// Issue #10: the light on the notch's border while the Overseer speaks. Approved Figma «Voce · Luce sul bordo»: a glow along the
// outline, on 0.5 s before the first word, brighter and wider with the voice volume, colours turning slowly round the border.
// It is its own colour family (orange, pink, violet, blue: Figma specs), never the green/yellow/red of the goal traffic light.
// Zero cost when silent: nothing is in the tree and no timeline runs. Reduce Motion: a steady glow, no rotation, no pulse.
// Place it as an overlay on the notch OUTSIDE its `.clipped()`, with the notch's own shape, so the glow can spill past the edge.

/// Dependency-free input: `speaking` and the voice volume `level` 0…1. `shape` is the notch outline.
struct VoiceEdgeLight<S: Shape>: View {
    let speaking: Bool
    let level: Float
    let shape: S

    var body: some View {
        if speaking {
            VoiceGlowDriver(shape: shape, level: { _ in level }).transition(.opacity).allowsHitTesting(false)
        }
    }
}

extension VoiceEdgeLight where S == UnevenRoundedRectangle {
    /// Notch-like default outline: flat top, 24 pt bottom corners (the open island's).
    init(speaking: Bool, level: Float) {
        self.init(speaking: speaking, level: level,
                  shape: UnevenRoundedRectangle(bottomLeadingRadius: 24, bottomTrailingRadius: 24))
    }
}

/// Reads the store: the level comes off the clock from the player's envelope, so there is one timeline, not two.
struct VoiceEdgeLightLive<S: Shape>: View {
    @ObservedObject var voice: VoiceStore
    let shape: S

    var body: some View {
        if let s = voice.status {
            VoiceGlowDriver(shape: shape, level: s.level(at:)).transition(.opacity).allowsHitTesting(false)
        }
    }
}

/// Not generic on purpose: Swift has no static stored properties in generic types.
private enum VoiceEdgeLook {
    static let period: TimeInterval = 14 // one slow turn of the colours
    /// #FF9E0A → #FF3880 → #995CFF → #3399FF, back to orange so the turning loop has no seam.
    static let colors: [Color] = [
        Color(red: 1.00, green: 0.62, blue: 0.04), Color(red: 1.00, green: 0.22, blue: 0.50),
        Color(red: 0.60, green: 0.36, blue: 1.00), Color(red: 0.20, green: 0.60, blue: 1.00),
        Color(red: 1.00, green: 0.62, blue: 0.04),
    ]
}

/// The only place with a clock, and it exists only while this view is in the tree (= while speaking).
private struct VoiceGlowDriver<S: Shape>: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let shape: S
    let level: (Date) -> Float

    var body: some View {
        if reduceMotion {
            VoiceGlow(shape: shape, level: VoiceStatus.steadyLevel, phase: 0)
        } else {
            TimelineView(.animation) { ctx in
                VoiceGlow(shape: shape, level: level(ctx.date), phase: ctx.date.timeIntervalSinceReferenceDate / VoiceEdgeLook.period)
            }
        }
    }
}

private struct VoiceGlow<S: Shape>: View {
    let shape: S
    let level: Float
    let phase: Double

    var body: some View {
        let l = Double(level)
        let gradient = AngularGradient(colors: VoiceEdgeLook.colors, center: .center, angle: .degrees(phase * 360))
        ZStack {
            shape.stroke(gradient, lineWidth: 3 + 6 * l).blur(radius: 5 + 6 * l).opacity(0.55 + 0.45 * l)
            shape.stroke(gradient, lineWidth: 1.5 + 1.5 * l).opacity(0.7 + 0.3 * l)
        }
    }
}
