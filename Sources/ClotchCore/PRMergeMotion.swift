import Foundation

/// A merged PR in the open notch (#86): the row settles, one pass of light runs across it, then it leaves the
/// list (fade and fold up while the rows under it rise with the notch's spring). Reduce Motion: no light, the
/// row stays long enough to be read, then fades. Seconds.
public enum PRMergeMotion {
    /// The notch has finished opening and the eye has found the row before the light starts.
    public static let delay: TimeInterval = 0.45
    /// One pass of light, slow in and out like the Lock screen's text.
    public static let shimmer: TimeInterval = 1.5
    /// A short beat after the light, so the row reads as done before it goes.
    public static let hold: TimeInterval = 0.25
    /// The row's way out: the notch spring's response (`NotchMotion.spring`).
    public static let exit: TimeInterval = 0.38

    /// How long the row stays in the list before it is removed and its exit starts.
    public static func stay(reduceMotion: Bool) -> TimeInterval { delay + shimmer + hold }
    /// When the row is gone from the screen.
    public static func gone(reduceMotion: Bool) -> TimeInterval { stay(reduceMotion: reduceMotion) + (reduceMotion ? 0.15 : exit) }
}
