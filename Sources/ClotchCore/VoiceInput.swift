import Foundation

/// Voice in (#110): the settings, the Scribe v2 Realtime wire format and the live text. Pure, so Linux tests cover it;
/// the microphone, the socket and the local model live in the app (`VoiceCapture`, `ScribeSession`, `LocalTranscriber`).
public enum VoiceInput {
    /// The engine Roberto picks in «Voce»: ElevenLabs Scribe v2 Realtime (cloud, text while he speaks) or Parakeet TDT v3 on the Mac.
    public enum Engine: String, CaseIterable, Sendable {
        case scribe = "scribe"
        case local = "locale"
    }

    public static let sampleRate = 16_000
    /// «auto»: Scribe detects the language; Parakeet detects it too. Anything else is an ISO 639-1 code.
    public static let languages: [(code: String, name: String)] = [("it", "Italiano"), ("en", "English"), ("auto", "Automatica")]
    /// One utterance ends here, whatever the engine says: a forgotten shortcut never keeps the microphone open.
    public static let maxSeconds: TimeInterval = 60

    public struct Config: Equatable, Sendable {
        public var engine: Engine
        public var language: String
        public var spoken: Bool

        /// config.json keys `ingresso_motore`, `ingresso_lingua`, `ingresso_a_voce`; a missing or odd value is the default
        /// (cloud engine, Italian, answers spoken).
        public init(_ config: [String: Any]) {
            engine = (config["ingresso_motore"] as? String).flatMap(Engine.init(rawValue:)) ?? .scribe
            let lang = (config["ingresso_lingua"] as? String) ?? "it"
            language = languages.contains { $0.code == lang } ? lang : "it"
            spoken = config["ingresso_a_voce"] as? Bool ?? true
        }
    }

    /// Mean level of 16-bit little-endian mono samples, 0…1, lifted so a normal voice fills most of the range.
    public static func level(pcm16 data: Data) -> Double {
        let n = data.count / 2
        guard n > 0 else { return 0 }
        var sum = 0.0
        data.withUnsafeBytes { raw in
            for i in 0..<n {
                let s = Double(Int16(littleEndian: raw.loadUnaligned(fromByteOffset: i * 2, as: Int16.self))) / 32768
                sum += s * s
            }
        }
        return min(1, (sum / Double(n)).squareRoot() * 5)
    }

    /// Float samples (what the audio engine gives) to the 16-bit PCM the sockets and `level` use.
    public static func pcm16(_ samples: [Float]) -> Data {
        var out = Data(capacity: samples.count * 2)
        for f in samples {
            var v = Int16(max(-1, min(1, f)) * 32767).littleEndian
            withUnsafeBytes(of: &v) { out.append(contentsOf: $0) }
        }
        return out
    }

    // MARK: - Scribe v2 Realtime

    /// Events of the socket that matter here; docs: elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime.
    public enum ScribeEvent: Equatable, Sendable {
        case started
        case partial(String)
        case committed(String)
        case failure(String)
        case ignored
    }

    /// Manual commit: the utterance is one segment, closed by Roberto's second press. `language` "auto" leaves detection to Scribe.
    public static func scribeURL(language: String) -> URL {
        var items = [URLQueryItem(name: "model_id", value: "scribe_v2_realtime"), URLQueryItem(name: "audio_format", value: "pcm_16000"),
                     URLQueryItem(name: "commit_strategy", value: "manual")]
        if language != "auto" { items.append(URLQueryItem(name: "language_code", value: language)) }
        var c = URLComponents(string: "wss://api.elevenlabs.io/v1/speech-to-text/realtime")!
        c.queryItems = items
        return c.url!
    }

    /// One `input_audio_chunk`. `commit` closes the segment (send it with the last chunk, or with a short silence).
    public static func scribeChunk(pcm: Data, commit: Bool) -> String {
        let body: [String: Any] = ["message_type": "input_audio_chunk", "audio_base_64": pcm.base64EncodedString(),
                                   "commit": commit, "sample_rate": sampleRate]
        return String(decoding: (try? JSONSerialization.data(withJSONObject: body)) ?? Data(), as: UTF8.self)
    }

    public static func scribeEvent(_ text: String) -> ScribeEvent {
        guard let o = (try? JSONSerialization.jsonObject(with: Data(text.utf8))) as? [String: Any],
              let type = o["message_type"] as? String else { return .ignored }
        switch type {
        case "session_started": return .started
        case "partial_transcript": return .partial(o["text"] as? String ?? "")
        case "committed_transcript", "committed_transcript_with_timestamps": return .committed(o["text"] as? String ?? "")
        case "warning", "scribe_warning": return .ignored
        default:
            // Every other type with an `error` is a failure: auth_error, quota_exceeded, rate_limited, input_error, …
            guard let message = o["error"] as? String else { return .ignored }
            return .failure(failureText(type: type, message: message))
        }
    }

    /// Plain Italian for the pill; the raw message stays out of it.
    static func failureText(type: String, message: String) -> String {
        switch type {
        case "auth_error", "unaccepted_terms": return "Chiave ElevenLabs non valida. Controllala in Voce."
        case "quota_exceeded", "rate_limited", "resource_exhausted": return "ElevenLabs è al limite. Riprova tra poco."
        case "insufficient_audio_activity": return "Non ho sentito niente."
        default: return "Il trascrittore ha dato errore. Riprova."
        }
    }

    // MARK: - Live text

    /// What the pill shows: committed segments, then the segment still changing.
    public struct Dictation: Equatable, Sendable {
        public private(set) var done: [String] = []
        public private(set) var partial = ""
        public init() {}

        public mutating func take(_ event: ScribeEvent) {
            switch event {
            case .partial(let t): partial = t
            case .committed(let t):
                if !t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { done.append(t.trimmingCharacters(in: .whitespacesAndNewlines)) }
                partial = ""
            default: break
            }
        }

        /// Local engines hand over the whole text so far each time: it replaces the current segment.
        public mutating func replace(with text: String) { partial = text }

        public var text: String {
            (done + [partial.trimmingCharacters(in: .whitespacesAndNewlines)]).filter { !$0.isEmpty }.joined(separator: " ")
        }
    }
}
