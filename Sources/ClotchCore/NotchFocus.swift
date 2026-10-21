import Foundation

/// #117: only Roberto opens the notch. A hover-enter is his only when the pointer itself moved onto the island;
/// with a still pointer the island grew or the window moved under it (a notification, a screen change, a rebuild).
public enum NotchFocus {
    /// How recent the last pointer move must be for an enter to be Roberto's.
    public static let pointerMoveWindow: Double = 0.25

    public static func isUserHover(secondsSincePointerMoved seconds: Double) -> Bool {
        seconds >= 0 && seconds < pointerMoveWindow
    }
}

/// An enter with a still pointer waits: the first real move of the pointer inside the island counts as the enter.
public struct NotchHoverGate {
    /// Where the pointer rested when the island came under it; nil when nothing waits.
    private var stillAt: CGPoint?

    public init() {}

    /// The pointer is now over the island. True when it counts as Roberto's hover now.
    public mutating func enter(at point: CGPoint, secondsSincePointerMoved seconds: Double) -> Bool {
        if NotchFocus.isUserHover(secondsSincePointerMoved: seconds) { stillAt = nil; return true }
        stillAt = point
        return false
    }

    /// The pointer moved inside the island. True once, when it left the point where it rested.
    public mutating func move(to point: CGPoint) -> Bool {
        guard let s = stillAt, abs(point.x - s.x) + abs(point.y - s.y) >= 1 else { return false }
        stillAt = nil
        return true
    }

    public mutating func exit() { stillAt = nil }
}
