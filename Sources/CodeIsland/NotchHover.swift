import SwiftUI

// MARK: - Hover (#47)

/// The one hover of Clotch: under the pointer a clickable thing lifts its colour, small ones also grow to 1.03,
/// and the pointer becomes a hand. Reduce Motion: colour only, with a short fade.
struct HoverLift: ViewModifier {
    var small = false
    /// The notch is always black; the settings window follows the system (nil).
    var onDark: Bool? = true
    @State private var hovered = false
    @Environment(\.isEnabled) private var enabled
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let lit = hovered && enabled
        let lift = (onDark ?? (scheme == .dark)) ? 0.12 : -0.06
        return content
            .brightness(lit ? lift : 0)
            .scaleEffect(lit && small && !reduceMotion ? 1.03 : 1)
            .animation(reduceMotion ? NotchMotion.still : NotchMotion.hover, value: lit)
            .onHover { hovered = $0 }
            .handPointer(enabled)
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

extension View {
    /// The same hover for a tappable view that is not a Button (onTapGesture).
    func notchHover(small: Bool = false, onDark: Bool? = true) -> some View {
        modifier(HoverLift(small: small, onDark: onDark))
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
