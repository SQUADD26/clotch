import AppKit
import CodeIslandCore
import SwiftUI

/// The shell's motion (#68): the shape first, the content after it; closing is the reverse, faster.
/// Reduce Motion: a short fade.
enum NotchAnimation {
    private static var reduce: Bool { NSWorkspace.shared.accessibilityDisplayShouldReduceMotion }
    private static var openMs: Int { NotchTiming.openMs(.standard) }
    private static var closeMs: Int { NotchTiming.closeMs(.standard) }

    /// The shell grows out of the notch in the time chosen in Settings, no overshoot (#68).
    static var open: Animation { shell(openMs) }
    /// The shell goes back into the notch, faster by default.
    static var close: Animation { shell(closeMs) }
    /// The content comes in once the shell has made room, and ends with it.
    static var contentIn: Animation {
        if reduce { return NotchMotion.still }
        let c = NotchTiming.contentIn(openMs: openMs)
        return .easeOut(duration: c.duration).delay(c.delay)
    }
    /// The content leaves first, before the shell closes over it.
    static var contentOut: Animation {
        reduce ? NotchMotion.still : .easeIn(duration: NotchTiming.contentOut(closeMs: closeMs))
    }

    private static func shell(_ ms: Int) -> Animation {
        let s = NotchTiming.spring(ms: ms)
        return reduce ? NotchMotion.still : .spring(duration: s.duration, bounce: s.bounce)
    }
    /// 通知弹出：auto-expand opens like a hover does; a bouncier spring overshot the notch.
    static var pop: Animation { open }
    /// 微交互：hover 状态变化、按钮高亮等
    static let micro = NotchMotion.still
    /// Hover 预备段：全量展开的延迟计时期间，先给一个轻量的"我看到你了"反馈
    static let hoverPrehover = Animation.easeOut(duration: NotchHoverInteraction.prehoverAnimationDuration)
}

// MARK: - Blur + Fade transition

private struct BlurFadeModifier: ViewModifier {
    let active: Bool
    func body(content: Content) -> some View {
        // No compositingGroup here: macOS 26 renders compositingGroup + blur
        // (even with radius 0 in the identity state) transparent until a forced
        // re-composition, which made the approval card invisible except on hover
        // (issue #100).
        content
            .blur(radius: active ? 5 : 0)
            .opacity(active ? 0 : 1)
    }
}

extension AnyTransition {
    /// Blur out + fade — smoother than plain opacity for notch content switches.
    static var blurFade: AnyTransition {
        .modifier(
            active: BlurFadeModifier(active: true),
            identity: BlurFadeModifier(active: false)
        )
    }
}

// MARK: - MorphText — blur morph on text change

/// Text that briefly blurs when its content changes, creating a smooth "morph" effect.
///
/// Opt in with `streamsRapidly` for sources that push token-level deltas (AiWork /
/// Agentix `stream.text_delta` into the `$` row): those updates swap text
/// immediately instead of morphing, because each change would otherwise restart the
/// blur cycle and leave the label permanently unreadable. Every other caller keeps
/// the original morph behaviour — this is deliberately not a global change.
struct MorphText: View {
    let text: String
    var font: Font = .system(size: 12)
    var color: Color = .white
    var lineLimit: Int? = 1
    /// True only for sources in `SessionSnapshot.rapidStreamingSources`.
    var streamsRapidly: Bool = false

    @State private var displayed: String
    @State private var blur: CGFloat = 0
    @State private var generation = 0
    /// Monotonic (`systemUptime`), not wall-clock: an NTP correction or a
    /// sleep/wake that steps the clock backward would make the elapsed test
    /// negative and pin the label into no-morph mode. Same posture as
    /// MascotAnimationGate's wake-drift handling (#225).
    @State private var lastChangeAt: TimeInterval = -.greatestFiniteMagnitude

    /// Updates arriving within this window are treated as a stream, not a morph.
    private static let streamWindow: TimeInterval = 0.22

    init(
        text: String,
        font: Font = .system(size: 12),
        color: Color = .white,
        lineLimit: Int? = 1,
        streamsRapidly: Bool = false
    ) {
        self.text = text
        self.font = font
        self.color = color
        self.lineLimit = lineLimit
        self.streamsRapidly = streamsRapidly
        _displayed = State(initialValue: text)
    }

    var body: some View {
        Text(displayed)
            .font(font)
            .foregroundStyle(color)
            .lineLimit(lineLimit)
            .blur(radius: blur * 4)
            .opacity(1 - blur * 0.15)
            .compositingGroup()
            .onChange(of: text) { _, newText in
                guard newText != displayed else { return }
                let now = ProcessInfo.processInfo.systemUptime
                let streaming = streamsRapidly
                    && (now - lastChangeAt < Self.streamWindow || blur > 0.01)
                lastChangeAt = now
                generation += 1
                let gen = generation

                if streaming {
                    // Keep the label sharp while content is still arriving.
                    displayed = newText
                    if blur != 0 {
                        withAnimation(.easeOut(duration: 0.12)) { blur = 0 }
                    }
                    return
                }

                withAnimation(.easeOut(duration: 0.1)) { blur = 1 }
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(60))
                    guard gen == generation else { return }
                    displayed = newText
                    withAnimation(.easeOut(duration: 0.15)) { blur = 0 }
                }
            }
    }
}
