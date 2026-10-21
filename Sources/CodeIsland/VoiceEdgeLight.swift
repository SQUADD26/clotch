import SwiftUI
import CodeIslandCore

// Issue #15 (first cut #10): the light on the notch's outline while the Overseer speaks, in the style of Apple Intelligence's
// edge glow. Apple Intelligence's colours flow along the outline at one steady pace: a sharp line and two soft halos. The voice
// only brightens and widens the halos, averaged over 0.4 s, so the light swells with the phrases and never pulses with syllables.
// Zero cost when silent: nothing is in the tree and no timeline runs. Reduce Motion: a still glow at a steady level.
// Place it as an overlay on the notch OUTSIDE its `.clipped()`, with the notch's own shape, so the glow can spill past the edge.

/// Reads the store: the level comes off the clock from the player's envelope, so there is one timeline, not two.
struct VoiceEdgeLightLive<S: Shape>: View {
    @ObservedObject var voice: VoiceStore
    let shape: S

    var body: some View {
        ZStack {
            if let s = voice.status {
                VoiceGlowDriver(shape: shape, level: s.level(at:)).transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.4), value: voice.status == nil)
        .allowsHitTesting(false)
    }
}

/// Not generic on purpose: Swift has no static stored properties in generic types.
enum VoiceEdgeLook {
    static let period: TimeInterval = 6 // one lap of the colours round the outline
    static let segments = 48 // one solid colour each; the round caps and the halos' blur hide the steps
    static let window: TimeInterval = 0.4 // the voice is averaged over this span, centred on now
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
    let level: (Date) -> Float

    var body: some View {
        if reduceMotion {
            VoiceGlow(shape: shape, level: VoiceStatus.steadyLevel, phase: 0)
        } else {
            TimelineView(.animation(minimumInterval: 1 / 60)) { ctx in
                VoiceGlow(shape: shape, level: smoothed(at: ctx.date),
                          phase: ctx.date.timeIntervalSinceReferenceDate / VoiceEdgeLook.period)
            }
        }
    }

    /// The envelope is computed before the audio plays, so the average can look ahead: the swell comes on time, not late.
    private func smoothed(at date: Date) -> Float {
        let n = 9
        let sum = (0..<n).reduce(Float(0)) { acc, i in
            acc + level(date.addingTimeInterval(VoiceEdgeLook.window * (Double(i) / Double(n - 1) - 0.5)))
        }
        return sum / Float(n)
    }
}

/// One frame of the light: `level` 0…1, `phase` in laps of the colours.
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
