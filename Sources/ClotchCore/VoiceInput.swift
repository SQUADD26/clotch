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
    public static let maxSeconds: TimeInterval = 300
    /// After the second press the microphone keeps going this long: the last word and the audio still on its way are kept (#174).
    public static let tailSeconds: TimeInterval = 0.4
    /// Scribe: the longest wait for the text of the closing commit; it usually comes in well under a second.
    public static let commitWait: TimeInterval = 10

    public struct Config: Equatable, Sendable {
        public var engine: Engine
        public var language: String
        public var spoken: Bool
        public var mode: Mode
        /// The switch «Dettatura accesa»: off, the shortcut does nothing.
        public var enabled: Bool
        /// Unique id of the input device; "" = the system's.
        public var microphone: String
        /// The model that is the Overseer when Roberto speaks (clotch#286): one of `VoiceTurn.models`, Haiku by default.
        public var overseerModel: String

        /// config.json keys `ingresso_motore`, `ingresso_lingua`, `ingresso_a_voce`, `ingresso_modo`, `ingresso_acceso`, `ingresso_microfono`, `overseer_modello`;
        /// a missing or odd value is the default (cloud engine, Italian, answers spoken, hold the key, on, the system's microphone).
        public init(_ config: [String: Any]) {
            engine = (config["ingresso_motore"] as? String).flatMap(Engine.init(rawValue:)) ?? .scribe
            let lang = (config["ingresso_lingua"] as? String) ?? "it"
            language = languages.contains { $0.code == lang } ? lang : "it"
            spoken = config["ingresso_a_voce"] as? Bool ?? true
            mode = (config["ingresso_modo"] as? String).flatMap(Mode.init(rawValue:)) ?? .hold
            enabled = config["ingresso_acceso"] as? Bool ?? true
            microphone = config["ingresso_microfono"] as? String ?? ""
            overseerModel = VoiceTurn.models.first { $0 == config["overseer_modello"] as? String } ?? VoiceTurn.models[0]
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

    /// The system's names, as the engines mishear them in Italian (#242: «Allover Saird», «Oversayer», «Cloche»): the helper and
    /// the Overseer read the right word. Whole words only, so «game over» or «lover» stay as they are.
    static let names: [(pattern: String, name: String)] = [
        (#"(?i)\b(?:(all|dell|nell)'?\s?)?(?:o\s?ver\s?s(?:a|e|i)y?[ei]?e?r[de]?|fr[ae]?i?d[ae]i?[iy]?)\b"#, "clotch AI"),
        (#"(?i)\bcl[ou](?:ch|ce|che|tch|tsch|ck)\s+(?:ei\s?)?ai\b"#, "clotch AI"),  // the product is written in lowercase (#437)
        (#"(?i)\bcl[ou](?:ch|ce|che|tch|tsch)\b(?!\s+ai\b)"#, "Clotch"),
        (#"(?i)\bap(?:i|ri)[\s-]+master\b"#, "apri-master"),  // «API Master», «apri master» (#271)
    ]

    public static func fixNames(_ text: String) -> String {
        names.reduce(text) { t, n in
            guard let re = try? NSRegularExpression(pattern: n.pattern) else { return t }
            var out = t
            // From the end, so the ranges still to replace keep their place.
            for m in re.matches(in: t, range: NSRange(t.startIndex..., in: t)).reversed() {
                guard let whole = Range(m.range, in: out) else { continue }
                var prep = (m.numberOfRanges > 1 ? Range(m.range(at: 1), in: out) : nil).map { ["all": "a ", "dell": "di ", "nell": "in "][out[$0].lowercased()] ?? "" } ?? ""
                if whole.lowerBound == out.startIndex { prep = prep.prefix(1).uppercased() + prep.dropFirst() }
                out.replaceSubrange(whole, with: prep + n.name)
            }
            return out
        }
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

    /// Recording longer than this with no words, or a level that never moved, is not Roberto's silence: the microphone gave nothing (#269).
    public static let heardAfter: TimeInterval = 2

    /// «Non ho sentito niente» (#269): `seconds` of recording, the words that came out and the loudest level the meter saw (0…1).
    /// A quick tap stays a choice not to speak (#147); 16 s of nothing is a deaf microphone.
    public static func heardNothing(seconds: TimeInterval, words: Int, peak: Double) -> Bool {
        seconds > heardAfter && (words == 0 || peak == 0)
    }

    /// Why a dictation stopped, as the pill says it (Figma #110, note 5 and 6): what happened, why, and what Roberto can do.
    /// Never a code or a raw message.
    public enum Failure: Equatable, Sendable {
        case mic, key, credits, network, local
        /// The key is pressed with «Dettatura accesa» off / the shortcut could not be registered: never a silent key (#198).
        case off, shortcut
        /// `~/.config/voce/non-disturbare` exists (clotch#266): no microphone, nothing to dictate.
        case doNotDisturb
        /// A dictation of more than `heardAfter` s with no words or no level at all (#269): never a bar that closes mute.
        case nothingHeard
        /// #314: ElevenLabs answered with an error of its own (rate_limited, transcriber_error, …), or refused the audio (input_error).
        case service, audio
        /// #1120: the voice is not Roberto's, or not sure; no print yet; the Mac is locked.
        case notYou, unsure, noVoiceprint, locked

        public var title: String {
            switch self {
            case .mic: return "Clotch non può usare il microfono"
            case .key: return "La chiave di ElevenLabs non funziona"
            case .credits: return "Crediti ElevenLabs finiti"
            case .network: return "Non riesco a trascrivere"
            case .local: return "Il modello locale non parte"
            case .off: return "Dettatura spenta"
            case .shortcut: return "Scorciatoia non disponibile"
            case .doNotDisturb: return "Non disturbare acceso"
            case .nothingHeard: return "Non ho sentito niente"
            case .service: return "ElevenLabs non trascrive"
            case .audio: return "ElevenLabs rifiuta l'audio"
            case .notYou: return "Non è la voce di Roberto"
            case .unsure: return "Non sono sicura che sei tu"
            case .noVoiceprint: return "Manca l'impronta della tua voce"
            case .locked: return "Mac bloccato"
            }
        }

        public var detail: String {
            switch self {
            case .mic: return "Attiva Clotch in Privacy › Microfono: appena lo fai, torno ad ascoltare."
            case .key: return "Forse è sbagliata o scaduta. Controllala nelle impostazioni."
            case .credits: return "Non posso più trascrivere in rete."
            case .network: return "Niente connessione, oppure il servizio è lento."
            case .local: return "Riprova. Se non basta, passa a ElevenLabs nelle impostazioni."
            case .off: return "Accendila nelle impostazioni per dettare."
            case .shortcut: return "Un altro programma usa questo tasto. Scegline un altro nelle impostazioni."
            case .doNotDisturb: return "Spegnilo con non-disturbare off, poi riprova."
            case .nothingHeard: return "Il microfono non mi ha dato voce. Riprova, o scegli un altro microfono."
            case .service: return "Riprova tra poco, o usa il modello locale."
            case .audio: return "Riprova, o scegli un altro microfono."
            case .notYou: return "Non faccio niente. Se sei tu, registra di nuovo la voce nelle impostazioni."
            case .unsure: return "Non faccio niente. Ripeti più vicino al microfono."
            case .noVoiceprint: return "Senza la tua voce non eseguo ordini. Registrala una volta nelle impostazioni."
            case .locked: return "Sblocca il Mac per dare ordini a voce."
            }
        }

        /// The buttons under the text, the first is the main one.
        public var actions: [Action] {
            switch self {
            case .mic: return [.openPrivacy]
            case .key: return [.checkKey, .useLocal]
            case .credits: return [.useLocal]
            case .network, .service: return [.retry, .useLocal]
            case .local, .doNotDisturb: return [.retry]
            case .off, .shortcut: return [.openDictation]
            case .nothingHeard, .audio, .unsure: return [.retry, .openDictation]
            case .notYou, .noVoiceprint: return [.openDictation]
            case .locked: return [.retry]
            }
        }
    }

    public enum Action: Equatable, Sendable {
        case openPrivacy, checkKey, useLocal, retry, openDictation

        public var label: String {
            switch self {
            case .openPrivacy: return "Apri Privacy › Microfono"
            case .checkKey: return "Controlla la chiave"
            case .useLocal: return "Usa il modello locale"
            case .retry: return "Riprova"
            case .openDictation: return "Apri Dettatura"
            }
        }
    }

    /// Scribe's error types (docs: elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime) to what the pill says.
    static func failure(type: String) -> Failure {
        switch type {
        case "auth_error", "unaccepted_terms": return .key
        case "quota_exceeded": return .credits
        // #314: under 0.3 s of audio at the commit: the microphone gave nothing, the connection is fine
        case "commit_throttled": return .nothingHeard
        case "input_error": return .audio
        default: return .service  // rate_limited, resource_exhausted, transcriber_error, …
        }
    }

    /// The socket closed without a message: refused at the handshake (HTTP status), else the connection itself.
    public static func failure(httpStatus: Int) -> Failure {
        switch httpStatus {
        case 401, 403: return .key
        case 402: return .credits
        case 400...599: return .service
        default: return .network
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
