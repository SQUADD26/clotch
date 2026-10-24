import Foundation

/// Voce fidata (#1120): an order by voice counts only when it is Roberto's. The voiceprint is a list of speaker embeddings made on this
/// Mac and kept only here (`print` file, 0600): never in a repo, never in a log, never sent out. Only the verdict goes to the engine.
/// Pure, so the Linux tests cover the thresholds, the risk list and the store.
public enum VoiceTrust {
    public enum Verdict: String, Sendable { case yes = "si", no, uncertain = "incerto" }

    /// Cosine distance to the voiceprint: under `yesBelow` it is him, over `noAbove` it is someone else, between is not sure.
    /// shortcut: thresholds measured on `say` voices and the recorded phrases (see the PR), re-tune with Roberto's real microphone.
    public static let yesBelow: Float = 0.35
    public static let noAbove: Float = 0.55
    /// Less audio than this gives a noisy embedding: never «yes».
    public static let minSeconds = 1.5
    public static let enrollPhrases = 3

    public static func verdict(distance: Float, seconds: Double) -> Verdict {
        guard distance.isFinite, seconds >= minSeconds else { return .uncertain }
        return distance < yesBelow ? .yes : (distance > noAbove ? .no : .uncertain)
    }

    public static func distance(_ a: [Float], _ b: [Float]) -> Float {
        guard a.count == b.count, !a.isEmpty else { return .infinity }
        let dot = zip(a, b).reduce(Float(0)) { $0 + $1.0 * $1.1 }
        let na = a.reduce(Float(0)) { $0 + $1 * $1 }.squareRoot(), nb = b.reduce(Float(0)) { $0 + $1 * $1 }.squareRoot()
        return na > 0 && nb > 0 ? 1 - dot / (na * nb) : .infinity
    }

    /// The best (smallest) distance to any of the enrolled phrases: Roberto sounds different tired, close or far from the microphone.
    public static func distance(_ embedding: [Float], to print: [[Float]]) -> Float {
        print.map { distance(embedding, $0) }.min() ?? .infinity
    }

    /// The enrolment is good when the phrases sound alike: one with a TV or another person in it is asked again.
    public static func consistent(_ print: [[Float]]) -> Bool {
        for i in print.indices { for j in print.indices where j > i && distance(print[i], print[j]) > yesBelow { return false } }
        return print.count >= enrollPhrases
    }

    /// An order is taken only with all three: dictation started from the notch's key (never by a program), Mac unlocked, voice «yes».
    public static func accepted(fromKey: Bool, unlocked: Bool, verdict: Verdict) -> Bool { fromKey && unlocked && verdict == .yes }

    /// Irreversible, money, production, messages to others: the engine asks Roberto to confirm by voice (his print) or in Friday's chat. No tap (his words, 24/10).
    private static let risky = try! NSRegularExpression(pattern:
        #"\b(elimin\w*|cancell\w*|rimuov\w*|butta\w*|distrugg\w*|formatt\w*|svuota\w*|paga\w*|pagament\w*|bonific\w*|rimbors\w*|compra\w*|acquist\w*|fattur\w*|produzione|deploy\w*|pubblic\w*|promuov\w*|promozione|merge\w*|push\w*|force|manda\w*|invia\w*|scrivi a|rispondi a|mail|email|messaggio a|whatsapp|sms)\b"#)
    public static func isRisky(_ text: String) -> Bool {
        let t = text.lowercased()
        return risky.firstMatch(in: t, range: NSRange(t.startIndex..., in: t)) != nil
    }

    /// What goes to the engine with the sentence (field `voce` of `parla`, claude-config#2771): the verdict and the distance, nothing of the print.
    public static func payload(verdict: Verdict, distance: Float, fromKey: Bool, unlocked: Bool, risky: Bool) -> [String: Any] {
        ["esito": verdict.rawValue, "distanza": distance.isFinite ? (Double(distance) * 1000).rounded() / 1000 : -1,
         "tasto": fromKey, "sbloccato": unlocked, "rischiosa": risky]
    }

    // MARK: - The print on disk

    public struct Store {
        public let url: URL
        public init(url: URL = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Clotch/voce-impronta.json")) { self.url = url }

        public var load: [[Float]] { ((try? Data(contentsOf: url)).flatMap { try? JSONDecoder().decode([[Float]].self, from: $0) }) ?? [] }
        public var exists: Bool { !load.isEmpty }

        public func save(_ print: [[Float]]) throws {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
            try JSONEncoder().encode(print).write(to: url, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
        }

        public func erase() { try? FileManager.default.removeItem(at: url) }
    }
}
