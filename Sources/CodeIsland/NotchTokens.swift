import SwiftUI

// Design tokens of the notch (Figma «Notch nero pieno», approved 2026-10-21): colour, spacing, type and
// motion, in one place. The views only read them.

// MARK: - Colour

/// The three colours of the traffic light: Apple's dark-appearance system green, yellow and red,
/// so they sit on the black notch like the Dynamic Island's own tints (all above 4.5:1 on black).
enum GoalTone {
    case go, wait, stop

    var color: Color {
        switch self {
        case .go: return Color(red: 48 / 255, green: 209 / 255, blue: 88 / 255)
        case .wait: return Color(red: 1, green: 214 / 255, blue: 10 / 255)
        case .stop: return Color(red: 1, green: 69 / 255, blue: 58 / 255)
        }
    }
}

/// Text levels and fills on black: the Figma specs' opacities of white (specs.md, «Colori»).
enum GoalInk {
    static let primary = Color.white
    static let row = Color.white.opacity(0.92)
    static let strong = Color.white.opacity(0.8)
    static let description = Color.white.opacity(0.66)
    static let off = Color.white.opacity(0.6)
    static let secondary = Color.white.opacity(0.55)
    /// Waiting and struck-through text.
    static let quiet = Color.white.opacity(0.45)
    static let track = Color.white.opacity(0.16)
    static let ringTrack = Color.white.opacity(0.22)
    static let barTrack = Color.white.opacity(0.18)
    /// A ring with no declared proofs: only its outline.
    static let bare = Color.white.opacity(0.35)
    static let divider = Color.white.opacity(0.08)
    /// The tab bar's well and its selected segment.
    static let well = Color.white.opacity(0.07)
    static let selected = Color.white.opacity(0.16)
    static let button = Color.white.opacity(0.12)
    static let buttonOff = Color.white.opacity(0.06)
    static let card = Color.white.opacity(0.05)
    static let cardInUse = Color.white.opacity(0.09)
    /// The dark check inside a green circle.
    static let check = Color(red: 6 / 255, green: 33 / 255, blue: 15 / 255)
}

// MARK: - Scale

/// One spacing scale on a 4/8 pt grid.
enum NotchSpace {
    static let side: CGFloat = 26      // open notch edge to content
    static let bottom: CGFloat = 22    // last content to the open notch's bottom edge
    static let section: CGFloat = 16   // between blocks of one page
    static let row: CGFloat = 8        // between rows
    static let tight: CGFloat = 4      // a line and what belongs to it
    static let radius: CGFloat = 30    // the open notch's bottom corners
    static let noteRadius: CGFloat = 26
    static let figureColumn: CGFloat = 40  // a right-aligned figure: fits «100%» and «12/12» in NotchType.numbers
}

/// The island's widths (Figma specs.md, «Forma dell'app»).
enum NotchSize {
    static let open: CGFloat = 560
    static let note: CGFloat = 440
    /// Each wing of the closed notch: 185 + 2 × 84 = 353 on a 14" MacBook Pro.
    static let wing: CGFloat = 84
}

/// One type scale (macOS text styles in points). SF Pro, Text up to 19 pt and Display from 20.
enum NotchType {
    static let label = Font.system(size: 12, weight: .medium)
    static let caption = Font.system(size: 12, weight: .semibold)
    static let numbers = Font.system(size: 12, weight: .semibold).monospacedDigit()
    static let small = Font.system(size: 11, weight: .medium)
    static let smallEmphasis = Font.system(size: 11, weight: .semibold)
    static let body = Font.system(size: 13)
    static let bodyEmphasis = Font.system(size: 13, weight: .medium)
    static let name = Font.system(size: 13, weight: .semibold)
    static let line = Font.system(size: 14, weight: .medium)
    static let note = Font.system(size: 14, weight: .semibold)
    static let tab = Font.system(size: 13, weight: .semibold)
    static let tabOff = Font.system(size: 13, weight: .medium)
    static let title = Font.system(size: 20, weight: .semibold)
    static let timer = Font.system(size: 12, weight: .semibold).monospacedDigit()
    static let ringFigure = Font.system(size: 16, weight: .semibold).monospacedDigit()
}

// MARK: - Motion

/// One spring for everything that moves in the notch; Reduce Motion swaps it for a short fade.
enum NotchMotion {
    /// The family's damping for the elements; the shell opens with no bounce (`NotchAnimation.open`, #68).
    static let damping = 0.86
    static let spring = Animation.spring(response: 0.38, dampingFraction: damping)
    static let still = Animation.easeOut(duration: 0.15)
    /// Hover: the same spring, shorter.
    static let hover = Animation.spring(response: 0.2, dampingFraction: 0.9)
    /// A page turn (#52): the same spring, starting at the gesture's speed (fraction of the travel per second).
    static func page(velocity: Double) -> Animation {
        .interpolatingSpring(duration: 0.38, bounce: 0.14, initialVelocity: velocity)
    }
    /// Pages under the fingers: a very short spring, so they track 1:1 and pick up a page in flight smoothly.
    static let follow = Animation.interactiveSpring(response: 0.1, dampingFraction: 0.9)

    static func animation(reduce: Bool) -> Animation { reduce ? still : spring }
}
