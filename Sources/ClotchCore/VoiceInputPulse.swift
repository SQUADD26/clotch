import Foundation

/// The red light of a dictation error (#145, #168): one short pulse, then dark for good, even while the error stays on the pill.
/// Never a blink, never a breath that lasts as long as the error. Pure: brightness 0…1 as a function of the seconds since the error.
public struct VoiceInputPulse: Sendable, Equatable {
    public let rise: TimeInterval
    public let hold: TimeInterval
    public let fall: TimeInterval

    public init(rise: TimeInterval, hold: TimeInterval, fall: TimeInterval) {
        (self.rise, self.hold, self.fall) = (rise, hold, fall)
    }

    /// After this long the light is off and stays off.
    public var total: TimeInterval { rise + hold + fall }

    public func level(at t: TimeInterval) -> Double {
        guard t > 0, t < total else { return 0 }
        if t < rise { return (1 - cos(.pi * t / rise)) / 2 }  // ease-in-out both ways: no step between two frames
        if t < rise + hold { return 1 }
        return (1 + cos(.pi * (t - rise - hold) / fall)) / 2
    }
}
