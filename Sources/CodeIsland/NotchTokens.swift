import SwiftUI

// Design tokens of the notch: colour, spacing and type, in one place. The approved Figma target
// replaces these values; the views only read them.

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

/// Text levels on black. Secondary stays at 0.62 so 11pt text keeps AA contrast.
enum GoalInk {
    static let primary = Color.white.opacity(0.94)
    static let secondary = Color.white.opacity(0.62)
    static let track = Color.white.opacity(0.14)
}

// MARK: - Scale

/// One spacing scale on a 4/8 pt grid. The island's bottom corners are 24 pt; plates sit 8 pt in,
/// so their 16 pt corners are concentric with it (HIG: concentric margins).
enum NotchSpace {
    static let inset: CGFloat = 8      // panel edge to plate, plate to plate
    static let plate: CGFloat = 16     // inside a plate
    static let radius: CGFloat = 16
    static let head: CGFloat = 12      // plate title to its content
    static let row: CGFloat = 8        // between rows
    static let tight: CGFloat = 4      // a line and what belongs to it (bar and its reason)
}

/// One type scale (macOS text styles in points): 11 labels, 12 secondary, 13 body, 15 title, 22 figure.
enum NotchType {
    static let label = Font.system(size: 11, weight: .semibold)
    static let caption = Font.system(size: 11, weight: .medium)
    static let numbers = Font.system(size: 11, weight: .semibold).monospacedDigit()
    static let secondary = Font.system(size: 12)
    static let body = Font.system(size: 13)
    static let bodyEmphasis = Font.system(size: 13, weight: .medium)
    static let title = Font.system(size: 15, weight: .semibold)
    static let figure = Font.system(size: 22, weight: .semibold, design: .rounded).monospacedDigit()
    static let figureUnit = Font.system(size: 13, weight: .medium, design: .rounded).monospacedDigit()
}
