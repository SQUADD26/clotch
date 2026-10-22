import Foundation

/// The red light of a dictation error (#145): it comes in slowly, then breathes gently. Never a flash.
/// Pure: the brightness 0…1 as a function of the seconds since the error began.
public enum VoiceInputLightCurve {
    /// The red comes in over this long, ease-out (quadratic: fast start, soft landing at full).
    public static let rise: TimeInterval = 0.6
    /// One slow breath, in seconds (≥ 2 s: nothing near a flash).
    public static let period: TimeInterval = 3.0
    /// The breath only dips this far from full: small on purpose.
    public static let depth = 0.12

    public static func red(at t: TimeInterval) -> Double {
        guard t > 0 else { return 0 }
        if t < rise { let x = 1 - t / rise; return 1 - x * x }
        // cos starts at its top, so the rise meets the breath with the same value and the same (flat) slope
        return 1 - depth * (1 - cos(2 * .pi * (t - rise) / period)) / 2
    }
}
