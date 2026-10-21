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

/// Text levels and fills on black. Secondary stays at 0.62 so 11pt text keeps AA contrast.
enum GoalInk {
    static let primary = Color.white.opacity(0.94)
    static let secondary = Color.white.opacity(0.62)
    static let track = Color.white.opacity(0.16)
    static let divider = Color.white.opacity(0.1)
    /// The tab bar's well and its selected segment; the page buttons.
    static let well = Color.white.opacity(0.08)
    static let selected = Color.white.opacity(0.18)
}

// MARK: - Scale

/// One spacing scale on a 4/8 pt grid.
enum NotchSpace {
    static let side: CGFloat = 28      // open notch edge to content
    static let section: CGFloat = 16   // between blocks of one page
    static let row: CGFloat = 8        // between rows
    static let tight: CGFloat = 4      // a line and what belongs to it
    static let radius: CGFloat = 28    // the open notch's bottom corners
    static let noteRadius: CGFloat = 18
    static let figureColumn: CGFloat = 40  // a right-aligned figure: fits «100%» and «12/12» in NotchType.numbers
}

/// One type scale (macOS text styles in points).
enum NotchType {
    static let label = Font.system(size: 12, weight: .medium)
    static let caption = Font.system(size: 12, weight: .semibold)
    static let numbers = Font.system(size: 12, weight: .semibold).monospacedDigit()
    static let body = Font.system(size: 13)
    static let bodyEmphasis = Font.system(size: 13, weight: .medium)
    static let tab = Font.system(size: 13, weight: .semibold)
    static let title = Font.system(size: 18, weight: .semibold)
    static let timer = Font.system(size: 13, weight: .semibold).monospacedDigit()
    static let ringFigure = Font.system(size: 17, weight: .semibold).monospacedDigit()
}

// MARK: - Motion

/// One spring for everything that moves in the notch; Reduce Motion swaps it for a short fade.
enum NotchMotion {
    static let spring = Animation.spring(response: 0.38, dampingFraction: 0.86)
    static let still = Animation.easeOut(duration: 0.15)

    static func animation(reduce: Bool) -> Animation { reduce ? still : spring }
}
