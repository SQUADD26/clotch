import Foundation

/// How long the notch takes to open and close, in milliseconds, chosen in Settings (#68).
/// The shell's spring is built from this time (`spring(duration:bounce: 0)`), so the
/// chosen time is the one on screen: a bounce-0 spring is 98.6% there at its duration.
public enum NotchTiming {
    public static let openKey = "notchOpenMs"
    public static let closeKey = "notchCloseMs"
    public static let range = 100...1000
    public static let step = 10
    public static let defaultOpenMs = 250
    public static let defaultCloseMs = 200
    /// No overshoot: the shell grows out of the notch and stops, like the Dynamic Island.
    public static let bounce = 0.0
    /// The content starts after this share of the open time, once the shell has made room.
    public static let contentDelayShare = 0.3
    /// On closing the content leaves first, in this share of the close time.
    public static let contentOutShare = 0.5

    /// The speed multipliers this replaces, and the spring responses they divided.
    static let oldOpenKey = "notchOpenSpeed"
    static let oldCloseKey = "notchCloseSpeed"
    static let oldOpenBaseMs = 420.0
    static let oldCloseBaseMs = 380.0

    public static func clamped(_ ms: Int) -> Int { min(max(ms, range.lowerBound), range.upperBound) }

    /// The spring for a time in ms: its duration in seconds and its bounce.
    public static func spring(ms: Int) -> (duration: TimeInterval, bounce: Double) {
        (Double(clamped(ms)) / 1000, bounce)
    }

    /// The content's way in: after the shell has made room, ending with it.
    public static func contentIn(openMs: Int) -> (delay: TimeInterval, duration: TimeInterval) {
        let total = spring(ms: openMs).duration
        return (total * contentDelayShare, total * (1 - contentDelayShare))
    }

    /// The content's way out: at once, faster than the shell.
    public static func contentOut(closeMs: Int) -> TimeInterval { spring(ms: closeMs).duration * contentOutShare }

    public static func openMs(_ defaults: UserDefaults) -> Int { stored(openKey, defaultOpenMs, defaults) }
    public static func closeMs(_ defaults: UserDefaults) -> Int { stored(closeKey, defaultCloseMs, defaults) }

    private static func stored(_ key: String, _ fallback: Int, _ defaults: UserDefaults) -> Int {
        defaults.object(forKey: key) == nil ? fallback : clamped(defaults.integer(forKey: key))
    }

    /// Turns a saved speed multiplier (0.5–2×) into the time it gave, once, and drops it.
    public static func migrate(_ defaults: UserDefaults) {
        for (old, new, base) in [(oldOpenKey, openKey, oldOpenBaseMs), (oldCloseKey, closeKey, oldCloseBaseMs)] {
            guard defaults.object(forKey: old) != nil else { continue }
            let speed = defaults.double(forKey: old)
            if defaults.object(forKey: new) == nil, speed.isFinite, speed > 0 {
                defaults.set(clamped(Int((base / speed).rounded())), forKey: new)
            }
            defaults.removeObject(forKey: old)
        }
    }
}
