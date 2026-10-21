import Foundation

// The voice light's data contract (issue #10). The Overseer's player (claude-config, Clean View `voce-io.ts`) writes
// ~/.config/voce/stato.json atomically, once before the audio starts and once when it ends:
//   { "v":1, "id":"…", "parla":true, "t_inizio":<epoch ms, first word>, "t_fine":<epoch ms>, "passo_ms":50, "livello":[0…1, …] }
// `livello` is the voice volume every `passo_ms` from `t_inizio`, computed from the mp3 BEFORE it plays, so the notch needs
// no live feed: it reads the level off the clock. Empty `livello` = steady light. Pure: the caller passes `now`.

public struct VoiceStatus: Equatable, Sendable {
    /// The light is on this long before the first word.
    public static let lead: TimeInterval = 0.5
    /// Intensity before the first word and with no `livello`: clearly visible, not yet moving with the voice.
    public static let steadyLevel: Float = 0.6

    public let id: String
    public let start: Date
    public let end: Date
    public let step: TimeInterval
    public let levels: [Float]

    /// nil = nothing to show: `parla` false, a missing field, a wrong version or an impossible time range.
    public static func parse(_ data: Data) -> VoiceStatus? {
        guard let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              (o["v"] as? Int) == 1, (o["parla"] as? Bool) == true,
              let t0 = (o["t_inizio"] as? NSNumber)?.doubleValue, let t1 = (o["t_fine"] as? NSNumber)?.doubleValue,
              t1 > t0, t1 - t0 <= 120_000 else { return nil }
        let step = max(10, min(1000, (o["passo_ms"] as? NSNumber)?.doubleValue ?? 50))
        let raw = (o["livello"] as? [NSNumber]) ?? []
        return VoiceStatus(id: o["id"] as? String ?? "", start: Date(timeIntervalSince1970: t0 / 1000),
                           end: Date(timeIntervalSince1970: t1 / 1000), step: step / 1000,
                           levels: raw.prefix(4000).map { Float(max(0, min(1, $0.doubleValue))) })
    }

    /// On from the write (0.5 s before the first word) until `t_fine`; a player that died leaves a file that expires by itself.
    public func isSpeaking(at now: Date) -> Bool { now < end }

    /// 0…1. Before the first word and with no samples: steady; after: the sample at `now`, interpolated.
    public func level(at now: Date) -> Float {
        let pos = now.timeIntervalSince(start) / step
        guard pos > 0, !levels.isEmpty else { return Self.steadyLevel }
        let i = Int(pos), f = Float(pos - Double(i))
        guard i < levels.count - 1 else { return levels[levels.count - 1] }
        return levels[i] + (levels[i + 1] - levels[i]) * f
    }

    // Issue #29: the light must never beat with the syllables. The level goes through a slow filter, then into a narrow,
    // high band, so the light is always clearly on and only drifts with the phrases.
    /// The light never drops below this: 0.8 = always clearly visible.
    public static let minIntensity: Float = 0.8
    /// Half-width of the filter: a triangle over ±1 s. A jump in the voice rises or falls over ~1 s (10→90%), and any
    /// beat of 1 s or faster (syllables, words) cancels out. Centred on now: the envelope is known ahead, so it is not late.
    public static let smoothing: TimeInterval = 1.0

    /// A level 0…1 mapped into the band `minIntensity`…1.
    public static func intensity(_ level: Float) -> Float { minIntensity + (1 - minIntensity) * level }

    /// The light's brightness at `now`, `minIntensity`…1: the level filtered by a triangle of ±`smoothing`, one tap per `step`.
    public func intensity(at now: Date) -> Float {
        let n = max(1, Int((Self.smoothing / step).rounded()))
        var sum: Float = 0
        for i in (1 - n)..<n {
            sum += Float(n - abs(i)) * level(at: now.addingTimeInterval(Double(i) * step))
        }
        return Self.intensity(sum / Float(n * n)) // the weights add up to n²
    }
}
