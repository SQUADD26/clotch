import Foundation

/// What lowers the OTHER apps' audio while the voice speaks (#83). The Mac backend is `AudioDucker` (a Core Audio process tap
/// that never touches the system volume); this file holds the timing and the guarantee that the others come back.
public protocol DuckBackend: AnyObject {
    /// Starts catching the other apps' audio at full gain. false = cannot (macOS < 14.2, nothing to catch, format not
    /// supported): the voice then speaks with no lowering.
    func begin() -> Bool
    /// Moves the others' gain to `gain` (1 = untouched) in a straight ramp of `seconds`.
    func fade(to gain: Double, over seconds: TimeInterval)
    /// Gives the others back at once, exactly as they were. Safe to call twice.
    func end()
}

public enum VoiceDuck {
    /// Others go down this long before the first word (the same half second as the edge light, `VoiceStatus.lead`),
    public static let fadeDown: TimeInterval = 0.5
    /// stay down this long after the last word,
    public static let hold: TimeInterval = 0.5
    /// and come back up over this long.
    public static let fadeUp: TimeInterval = 0.5

    public static let defaultLevel = 0.2
    public static let levelRange = 0.0...0.8

    /// Runs `voice` with the others lowered. `voice` starts exactly `fadeDown` after the fall begins (its own `VoiceStatus.lead`
    /// wait), whatever it returns. The others are given back in every way out: the voice ends, fails, or the task is cancelled
    /// (the waits then return at once, so the rise is cut and `end()` runs). A crash needs no code: the tap dies with the process.
    public static func around(_ backend: DuckBackend?, level: Double, sleep: (TimeInterval) async -> Void,
                              voice: () async -> String?) async -> String? {
        guard let backend, backend.begin() else { return await voice() }
        defer { backend.end() }
        backend.fade(to: level, over: fadeDown)
        let result = await voice()
        await sleep(hold)
        backend.fade(to: 1, over: fadeUp)
        await sleep(fadeUp)
        return result
    }
}
