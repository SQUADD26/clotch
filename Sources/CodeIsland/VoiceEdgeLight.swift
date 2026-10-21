import SwiftUI
import CodeIslandCore

// Issue #15 (first cut #10): the light on the notch's outline while the Overseer speaks, in the style of Apple Intelligence's
// edge glow. Apple Intelligence's colours flow along the outline at one steady pace: a sharp line and two soft halos. The motion
// is the flow of the colours. The voice only drifts the halos within a narrow, high band (`VoiceStatus.intensity(at:)`, #29),
// so the light never pulses. Long fades in and out. Zero cost when silent: nothing is in the tree and no timeline runs.
// Reduce Motion: a still glow at a steady level.
// Place it as an overlay on the notch OUTSIDE its `.clipped()`, with the notch's own shape, so the glow can spill past the edge.

/// Reads the store: the intensity comes off the clock from the player's envelope, so there is one timeline, not two.
struct VoiceEdgeLightLive<S: Shape>: View {
    @ObservedObject var voice: VoiceStore
    let shape: S
    @AppStorage(ClotchPrefs.voiceLight) private var on = ClotchPrefs.voiceLightDefault
    @AppStorage(ClotchPrefs.voiceLightStrength) private var strength = ClotchPrefs.voiceLightStrengthDefault

    var body: some View {
        ZStack {
            if on, let s = voice.status {  // «Luce della voce» off: nothing in the tree, no clock (#56)
                VoiceGlowDriver(shape: shape, intensity: s.intensity(at:)).transition(.opacity)
            }
        }
        .opacity(ClotchPrefs.strength(strength))
        .animation(.easeInOut(duration: 1.0), value: voice.status == nil) // long fade at the start and end of the voice
        .allowsHitTesting(false)
    }
}

/// Not generic on purpose: Swift has no static stored properties in generic types.
enum VoiceEdgeLook {
    static let period: TimeInterval = 6 // one lap of the colours round the outline
    static let segments = 48 // one solid colour each; the round caps and the halos' blur hide the steps
    /// Apple Intelligence's palette as a loop: #FFBA71 → #FF6778 → #F5B9EA → #C686FF → #8D9FFF, then back to orange.
    private static let palette: [(Double, Double, Double)] = [
        (1.00, 0.73, 0.44), (1.00, 0.40, 0.47), (0.96, 0.73, 0.92), (0.78, 0.53, 1.00), (0.55, 0.62, 1.00),
    ]

    /// The colour at `x` along the loop: any real number, only its fraction counts.
    static func color(_ x: Double) -> Color {
        let p = (x - x.rounded(.down)) * Double(palette.count)
        let i = Int(p) % palette.count, f = p - p.rounded(.down)
        let a = palette[i], b = palette[(i + 1) % palette.count]
        return Color(red: a.0 + (b.0 - a.0) * f, green: a.1 + (b.1 - a.1) * f, blue: a.2 + (b.2 - a.2) * f)
    }
}

/// The only place with a clock, and it exists only while this view is in the tree (= while speaking).
private struct VoiceGlowDriver<S: Shape>: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let shape: S
    let intensity: (Date) -> Float

    var body: some View {
        if reduceMotion {
            VoiceGlow(shape: shape, level: VoiceStatus.intensity(VoiceStatus.steadyLevel), phase: 0)
        } else {
            TimelineView(.animation(minimumInterval: 1 / 60)) { ctx in
                VoiceGlow(shape: shape, level: intensity(ctx.date),
                          phase: ctx.date.timeIntervalSinceReferenceDate / VoiceEdgeLook.period)
            }
        }
    }
}

/// One frame of the light: `level` 0…1 (already filtered and banded), `phase` in laps of the colours.
struct VoiceGlow<S: Shape>: View {
    let shape: S
    let level: Float
    let phase: Double

    var body: some View {
        let k = Double(level)
        ZStack {
            VoiceRing(shape: shape, width: 8 + 6 * k, phase: phase).blur(radius: 9).opacity(0.3 + 0.5 * k)
            VoiceRing(shape: shape, width: 4 + 2 * k, phase: phase).blur(radius: 3).opacity(0.5 + 0.4 * k)
            VoiceRing(shape: shape, width: 1.5, phase: phase).opacity(0.9)
        }
    }
}

/// The outline cut in `segments` pieces of one colour each, taken from where the piece sits on the loop: the colours flow
/// along the edge at one speed (an angular gradient bunches them in the middle of a wide notch). One GPU pass; the padding
/// gives the stroke room past the shape's frame, which the drawing group would cut.
private struct VoiceRing<S: Shape>: View {
    let shape: S
    let width: CGFloat
    let phase: Double

    var body: some View {
        let n = VoiceEdgeLook.segments, pad: CGFloat = 24
        ZStack {
            ForEach(0..<n, id: \.self) { i in
                let a = CGFloat(i) / CGFloat(n)
                shape.trim(from: a, to: a + 1 / CGFloat(n))
                    .stroke(VoiceEdgeLook.color(Double(a) - phase), style: StrokeStyle(lineWidth: width, lineCap: .round))
            }
        }
        .padding(pad)
        .drawingGroup()
        .padding(-pad)
    }
}
