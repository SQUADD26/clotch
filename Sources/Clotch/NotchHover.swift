import SwiftUI

// MARK: - Hover (#47)

/// The one hover of Clotch: under the pointer a clickable thing lifts its colour, small ones also grow to 1.03,
/// and the pointer becomes a hand. Reduce Motion: colour only, with a short fade.
struct HoverLift: ViewModifier {
    var small = false
    /// The notch is always black; the settings window follows the system (nil).
    var onDark: Bool? = true
    /// False where the tap does nothing now (a row with no session to open).
    var active = true
    @State private var hovered = false
    @Environment(\.isEnabled) private var enabled
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let lit = hovered && enabled && active
        let lift = (onDark ?? (scheme == .dark)) ? 0.12 : -0.06
        return content
            .brightness(lit ? lift : 0)
            .scaleEffect(lit && small && !reduceMotion ? 1.03 : 1)
            .animation(reduceMotion ? NotchMotion.still : NotchMotion.hover, value: lit)
            .onHover { hovered = $0 }
            .handPointer(enabled && active)
    }
}

/// Buttons: the hover above, a dimmer look while pressed.
struct HoverButtonStyle: ButtonStyle {
    var small = false
    var onDark: Bool? = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.75 : 1)
            .modifier(HoverLift(small: small, onDark: onDark))
    }
}

extension ButtonStyle where Self == HoverButtonStyle {
    /// A wide notch button (tab, footer link).
    static var notch: HoverButtonStyle { HoverButtonStyle() }
    /// A small notch button (arrow, pill, icon): it also grows a little.
    static var notchSmall: HoverButtonStyle { HoverButtonStyle(small: true) }
    /// A plain button in the settings window.
    static var window: HoverButtonStyle { HoverButtonStyle(small: true, onDark: nil) }
}

// MARK: - Tone pill (#65)

/// «Accetta» and «Rifiuta»: a pill tinted with its traffic-light tone. Under the pointer it fills with the
/// tone and the text turns dark, on the hover spring; pressed, it darkens. Reduce Motion: colour only, a short fade.
struct TonePillStyle: ButtonStyle {
    let tone: GoalTone

    func makeBody(configuration: Configuration) -> some View {
        TonePillBody(label: configuration.label, tone: tone, pressed: configuration.isPressed)
    }
}

extension ButtonStyle where Self == TonePillStyle {
    static func tone(_ tone: GoalTone) -> TonePillStyle { TonePillStyle(tone: tone) }
}

private struct TonePillBody<Label: View>: View {
    let label: Label
    let tone: GoalTone
    let pressed: Bool
    @State private var hovered = false
    @Environment(\.isEnabled) private var enabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let lit = hovered && enabled
        let motion = reduceMotion ? NotchMotion.still : NotchMotion.hover
        TonePill(label: label, tone: tone, lit: lit, pressed: pressed && enabled)
            .scaleEffect(lit && !reduceMotion ? 1.03 : 1)
            .animation(motion, value: lit)
            .animation(motion, value: pressed)
            .onHover { hovered = $0 }
            .handPointer(enabled)
    }
}

/// The pill in one state; the gallery draws all three still.
struct TonePill<Label: View>: View {
    let label: Label
    let tone: GoalTone
    var lit = false
    var pressed = false

    var body: some View {
        let full = lit || pressed
        label
            .font(NotchType.smallEmphasis)
            .foregroundStyle(full ? tone.ink : tone.color)
            .padding(.horizontal, 12)
            .frame(height: 26)
            .background(Capsule().fill(tone.color.opacity(full ? 1 : 0.16)))
            // -0.08 keeps the dark text above 4.5:1 on the pressed red.
            .brightness(pressed ? -0.08 : 0)
            .contentShape(Capsule())
    }
}

extension View {
    /// The same hover for a tappable view that is not a Button (onTapGesture).
    func notchHover(small: Bool = false, onDark: Bool? = true, active: Bool = true) -> some View {
        modifier(HoverLift(small: small, onDark: onDark, active: active))
    }

    /// Hand cursor where one clicks.
    @ViewBuilder func handPointer(_ active: Bool = true) -> some View {
        if #available(macOS 15, *) {
            pointerStyle(active ? .link : nil)
        } else {
            // shortcut: no hand cursor before macOS 15 (push/pop would stick when the view goes away); the hover still shows.
            self
        }
    }
}
