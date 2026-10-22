import Foundation

/// Voice in (#110): the settings, the Scribe v2 Realtime wire format and the live text. Pure, so Linux tests cover it;
/// the microphone, the socket and the local model live in the app (`VoiceCapture`, `ScribeSession`, `LocalTranscriber`).
public enum VoiceInput {
    /// The engine Roberto picks in «Voce»: ElevenLabs Scribe v2 Realtime (cloud, text while he speaks) or Parakeet TDT v3 on the Mac.
    public enum Engine: String, CaseIterable, Sendable {
        case scribe = "scribe"
        case local = "locale"
    }

    /// «Modo» of the «Dettatura» page: hold the key while he speaks (default, as drawn in Figma), or press to start and press to end.
    public enum Mode: String, CaseIterable, Sendable {
        case hold = "tieni"
        case toggle = "premi"
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
        public var mode: Mode
        /// The switch «Dettatura accesa»: off, the shortcut does nothing.
        public var enabled: Bool
        /// Unique id of the input device; "" = the system's.
        public var microphone: String

        /// config.json keys `ingresso_motore`, `ingresso_lingua`, `ingresso_a_voce`, `ingresso_modo`, `ingresso_acceso`, `ingresso_microfono`;
        /// a missing or odd value is the default (cloud engine, Italian, answers spoken, hold the key, on, the system's microphone).
        public init(_ config: [String: Any]) {
            engine = (config["ingresso_motore"] as? String).flatMap(Engine.init(rawValue:)) ?? .scribe
            let lang = (config["ingresso_lingua"] as? String) ?? "it"
            language = languages.contains { $0.code == lang } ? lang : "it"
            spoken = config["ingresso_a_voce"] as? Bool ?? true
            mode = (config["ingresso_modo"] as? String).flatMap(Mode.init(rawValue:)) ?? .hold
            enabled = config["ingresso_acceso"] as? Bool ?? true
            microphone = config["ingresso_microfono"] as? String ?? ""
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
        case failure(Failure)
        /// Scribe heard no voice: Roberto chose not to speak (#147), the pill folds away without an error.
        case quiet
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
            guard o["error"] is String else { return .ignored }
            if type == "insufficient_audio_activity" { return .quiet }
            return .failure(failure(type: type))
        }
    }

    /// Why a dictation stopped, as the pill says it (Figma #110, note 5 and 6): what happened, why, and what Roberto can do.
    /// Never a code or a raw message.
    public enum Failure: Equatable, Sendable {
        case mic, key, credits, network, local

        public var title: String {
            switch self {
            case .mic: return "Clotch non può usare il microfono"
            case .key: return "La chiave di ElevenLabs non funziona"
            case .credits: return "Crediti ElevenLabs finiti"
            case .network: return "Non riesco a trascrivere"
            case .local: return "Il modello locale non parte"
            }
        }

        public var detail: String {
            switch self {
            case .mic: return "Attiva Clotch in Privacy › Microfono: appena lo fai, torno ad ascoltare."
            case .key: return "Forse è sbagliata o scaduta. Controllala nelle impostazioni."
            case .credits: return "Non posso più trascrivere in rete."
            case .network: return "Niente connessione, oppure il servizio è lento."
            case .local: return "Riprova. Se non basta, passa a ElevenLabs nelle impostazioni."
            }
        }

        /// The buttons under the text, the first is the main one.
        public var actions: [Action] {
            switch self {
            case .mic: return [.openPrivacy]
            case .key: return [.checkKey, .useLocal]
            case .credits: return [.useLocal]
            case .network: return [.retry, .useLocal]
            case .local: return [.retry]
            }
        }
    }

    public enum Action: Equatable, Sendable {
        case openPrivacy, checkKey, useLocal, retry

        public var label: String {
            switch self {
            case .openPrivacy: return "Apri Privacy › Microfono"
            case .checkKey: return "Controlla la chiave"
            case .useLocal: return "Usa il modello locale"
            case .retry: return "Riprova"
            }
        }
    }

    /// Scribe's error types (docs: elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime) to what the pill says.
    static func failure(type: String) -> Failure {
        switch type {
        case "auth_error", "unaccepted_terms": return .key
        case "quota_exceeded": return .credits
        default: return .network  // rate_limited, resource_exhausted, transcriber_error, …
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

        /// The words Scribe has closed, apart from the segment still changing: the pill shows them brighter.
        public var sure: String { done.joined(separator: " ") }
        public var maybe: String { partial.trimmingCharacters(in: .whitespacesAndNewlines) }

        public var text: String {
            (done + [partial.trimmingCharacters(in: .whitespacesAndNewlines)]).filter { !$0.isEmpty }.joined(separator: " ")
        }
    }
}
