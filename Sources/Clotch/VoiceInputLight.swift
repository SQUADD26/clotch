import SwiftUI
import ClotchCore

/// The light on the island's outline while the pill listens (#110, Figma «LUCE SUL BORDO»): a 3 pt line and a soft halo (9 pt, blur 11).
/// White and light, steady, while Roberto speaks; on an error one short red pulse (`VoiceInputPulse`, #168), then dark even while
/// the error stays on the pill; nothing otherwise. Reduce Motion: red without the fades, for the same time.
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
            case .red: RedPulse(shape: shape, reduceMotion: reduceMotion, still: still)
            }
        }
        .animation(.easeInOut(duration: FigmaToken.MacOS27GoldenGate.durataLuceDissolvenza), value: light)
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

/// The red. Its clock starts when it enters the tree (`since`), so every error begins from dark; after `pulse.total` the view
/// leaves the tree, so no clock runs for the rest of the error (up to 5 min for the microphone). `still`: full red, no clock.
private struct RedPulse<S: Shape>: View {
    static var pulse: VoiceInputPulse {
        typealias T = FigmaToken.MacOS27GoldenGate
        return VoiceInputPulse(rise: T.durataLuceRossaCompare, hold: T.durataLuceRossaAccesa, fall: T.durataLuceRossaSpegne)
    }
    let shape: S
    let reduceMotion: Bool
    let still: Bool
    @State private var since = Date()
    @State private var done = false

    var body: some View {
        ZStack {
            if still {
                glow
            } else if !done {
                TimelineView(.animation(paused: reduceMotion)) { context in
                    glow.opacity(reduceMotion ? 1 : Self.pulse.level(at: context.date.timeIntervalSince(since)))
                }
            }
        }
        .task {
            try? await Task.sleep(nanoseconds: UInt64(Self.pulse.total * 1e9))
            done = true
        }
    }

    private var glow: some View { VoiceInputGlow(shape: shape, color: Color(red: 1, green: 0.27, blue: 0.23), line: 1, halo: 0.6) }
}
