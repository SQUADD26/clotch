import Foundation

/// A merged PR in the open notch (#86, #100): the row settles, one pass of light runs across it, it stays a
/// while, its text fades from left to right, then it leaves the list (folds up while the rows under it rise
/// with the notch's spring). Reduce Motion: no light, no wipe, the row stays as long, then fades. Seconds.
public enum PRMergeMotion {
    /// The notch has finished opening and the eye has found the row before the light starts.
    public static let delay: TimeInterval = 0.45
    /// One pass of light, slow in and out like the Lock screen's text.
    public static let shimmer: TimeInterval = 1.5
    /// A short beat after the light, so the row reads as done before it goes.
    public static let hold: TimeInterval = 0.25
    /// Roberto (#100): the merged row stays 2.5 s more, so it is seen.
    public static let linger: TimeInterval = 2.5
    /// The text fades from left to right before the row closes.
    public static let wipe: TimeInterval = 0.45
    /// The row's way out: the notch spring's response (`NotchMotion.spring`).
    public static let exit: TimeInterval = 0.38

    /// How long the row stays whole before its exit starts (the wipe; Reduce Motion: the fade).
    public static func stay(reduceMotion: Bool) -> TimeInterval { delay + shimmer + hold + linger }
    /// When the row is removed from the list and the rows under it rise.
    public static func removed(reduceMotion: Bool) -> TimeInterval { stay(reduceMotion: reduceMotion) + (reduceMotion ? 0 : wipe) }
    /// When the row is gone from the screen.
    public static func gone(reduceMotion: Bool) -> TimeInterval { removed(reduceMotion: reduceMotion) + (reduceMotion ? 0.15 : exit) }
}
