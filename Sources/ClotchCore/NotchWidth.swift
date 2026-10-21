import Foundation

/// The notch's widths in one place (#99): the window, the open notch, and the old «Larghezza isola» value.
public enum NotchWidth {
    /// The panel window: the widest the notch goes, open or closed.
    public static func window(screenWidth: CGFloat) -> CGFloat { min(620, screenWidth - 40) }

    /// The open notch: its own width, never narrower than the closed one, so opening only grows
    /// and width and height ride the same spring with no step back.
    public static func open(notchWidth: CGFloat, standard: CGFloat, closed: CGFloat, window: CGFloat) -> CGFloat {
        min(max(notchWidth + 200, standard, closed), window)
    }

    /// The old «Larghezza isola» setting (50–150% of the notch), gone since «Larghezza» is the only one.
    public static let oldScaleKey = "collapsedWidthScale"

    /// The old scale as a share of the «Larghezza» slider: only a widening survives.
    /// shortcut: 150% = the 14" growth (+92 of the 267 pt range); per screen it varies a little, re-tune in «Larghezza».
    public static func fraction(fromScale scale: Int) -> Double {
        Double(min(max(scale, 100), 150) - 100) / 50 * 0.35
    }

    /// A saved «Larghezza» with the old scale added on top, still within 0…1.
    public static func merged(width: Double, scale: Int) -> Double {
        let width = min(max(width, 0), 1)
        return width + fraction(fromScale: scale) * (1 - width)
    }
}
