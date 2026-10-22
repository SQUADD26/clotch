import Foundation
#if canImport(CoreGraphics)
import CoreGraphics
#endif

/// #264: which points of the island open the notch when the pointer passes over them. One rule, used by the view
/// as its hover area and by the tests: the closed notch opens only from the bar itself, never from the note line
/// or the buttons hanging under it (Roberto could not press them without the notch opening over them).
public enum NotchHoverArea {
    /// The part of the island column that tracks the pointer. Open: the whole column. Closed: the bar's strip.
    public static func region(column: CGRect, notchHeight: CGFloat, expanded: Bool) -> CGRect {
        guard !expanded else { return column }
        return CGRect(x: column.minX, y: column.minY, width: column.width, height: min(notchHeight, column.height))
    }

    public static func opens(at point: CGPoint, column: CGRect, notchHeight: CGFloat, expanded: Bool) -> Bool {
        region(column: column, notchHeight: notchHeight, expanded: expanded).contains(point)
    }
}
