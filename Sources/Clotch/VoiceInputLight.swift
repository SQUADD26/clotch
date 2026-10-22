import SwiftUI
import ClotchCore

/// The light on the island's outline while the pill listens (#110, Figma «LUCE SUL BORDO»): a 3 pt line and a soft halo (9 pt, blur 11).
/// White and light, steady, while Roberto speaks; on an error the red comes in over 0.6 s, then breathes slowly (`VoiceInputLightCurve`)
/// and dissolves when the error goes; nothing otherwise. Reduce Motion: steady red.
/// Place it as an overlay on the notch OUTSIDE its clip, with the notch's own shape, like `VoiceEdgeLightLive`.
struct VoiceInputLightLive<S: Shape>: View {
    let light: VoiceInputController.Light
    let shape: S
    /// A still picture (the gallery's snapshots): full red, no clock.
    var still = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            switch light {
            case .off: EmptyView()
            case .white: VoiceInputGlow(shape: shape, color: .white, line: 0.55, halo: 0.30).transition(.opacity)
            case .red: RedBreath(shape: shape, reduceMotion: reduceMotion || still)
            }
        }
        .animation(.easeInOut(duration: 0.6), value: light)
        .allowsHitTesting(false)
    }
}

private struct VoiceInputGlow<S: Shape>: View {
    let shape: S
    let color: Color
    let line: Double
    let halo: Double

    var body: some View {
        shape.stroke(color.opacity(line), lineWidth: 3)
            .background(shape.stroke(color.opacity(halo), lineWidth: 9).blur(radius: 11))
    }
}

/// The red. Its clock starts when it enters the tree (`since`), so every error begins from dark; the rise is the curve's,
/// so only the exit is a view transition (a dissolve). Reduce Motion: full red, no clock.
private struct RedBreath<S: Shape>: View {
    let shape: S
    let reduceMotion: Bool
    @State private var since = Date()

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            VoiceInputGlow(shape: shape, color: Color(red: 1, green: 0.27, blue: 0.23), line: 1, halo: 0.6)
                .opacity(reduceMotion ? 1 : VoiceInputLightCurve.red(at: context.date.timeIntervalSince(since)))
        }
        .transition(.asymmetric(insertion: .identity, removal: .opacity))
    }
}
