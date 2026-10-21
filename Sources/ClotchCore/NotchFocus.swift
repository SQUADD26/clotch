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
