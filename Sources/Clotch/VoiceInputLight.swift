import SwiftUI

/// The light on the island's outline while the pill listens (#110, Figma «LUCE SUL BORDO»): a 3 pt line and a soft halo (9 pt, blur 11).
/// White and light, steady, while Roberto speaks; red, about three flashes a second, on an error; nothing otherwise. Reduce Motion: steady red.
/// Place it as an overlay on the notch OUTSIDE its clip, with the notch's own shape, like `VoiceEdgeLightLive`.
struct VoiceInputLightLive<S: Shape>: View {
    let light: VoiceInputController.Light
    let shape: S
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            switch light {
            case .off: EmptyView()
            case .white: glow(.white, line: 0.55, halo: 0.30)
            case .red:
                TimelineView(.animation(paused: reduceMotion)) { context in
                    glow(Color(red: 1, green: 0.27, blue: 0.23), line: 1, halo: 0.6)
                        .opacity(reduceMotion ? 1 : 0.4 + 0.6 * (sin(context.date.timeIntervalSinceReferenceDate * 2 * .pi * 3) + 1) / 2)
                }
            }
        }
        .animation(.easeInOut(duration: 0.3), value: light)
        .allowsHitTesting(false)
    }

    private func glow(_ color: Color, line: Double, halo: Double) -> some View {
        shape.stroke(color.opacity(line), lineWidth: 3)
            .background(shape.stroke(color.opacity(halo), lineWidth: 9).blur(radius: 11))
            .transition(.opacity)
    }
}
