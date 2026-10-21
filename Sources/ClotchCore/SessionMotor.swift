import Foundation

// The true state of a session, as the config's engine writes it (clotch#114). Pure: no file I/O, no clock.

public enum SessionPhase: String, Sendable, CaseIterable {
    case lavora
    case aspettaRoberto = "aspetta_roberto"
    case aspettaAltro = "aspetta_altro"
    case ferma
    case problema

    /// The contract's names; case, spaces and dashes do not matter. nil = a name this build does not know.
    public init?(contract raw: String) {
        let key = raw.lowercased().trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "[ -]", with: "_", options: .regularExpression)
        guard let phase = Self(rawValue: key) else { return nil }
        self = phase
    }

    /// App-copy status label: adjective or participle, no sentence.
    public var label: String {
        switch self {
        case .lavora: return "In lavorazione"
        case .aspettaRoberto: return "In attesa di te"
        case .aspettaAltro: return "In attesa"
        case .ferma: return "Ferma"
        case .problema: return "Problema"
        }
    }

    /// Only a session that needs Roberto asks for his eye: it breathes until he opens it.
    public var pulses: Bool { self == .aspettaRoberto }

    /// Only a working session animates.
    public var animates: Bool { self == .lavora }

    /// Apple's dark-appearance tints, like `GoalTone`: green working, orange for Roberto, light neutral when
    /// it waits for something else, grey when still, red for a problem. Text-sized uses stay above 4.5:1 on black.
    public var rgb: RGB {
        switch self {
        case .lavora: return RGB(48, 209, 88)
        case .aspettaRoberto: return RGB(255, 159, 10)
        case .aspettaAltro: return RGB(199, 199, 204)
        case .ferma: return RGB(142, 142, 147)
        case .problema: return RGB(255, 69, 58)
        }
    }
}

public struct RGB: Equatable, Sendable {
    public let r: Int, g: Int, b: Int
    public init(_ r: Int, _ g: Int, _ b: Int) { (self.r, self.g, self.b) = (r, g, b) }
}

/// One state file: what the session does now, why, and since when.
public struct SessionMotor: Equatable, Sendable {
    public let cli: String
    /// The Claude app's session id, when the hook knew it: it survives a /clear, the cli id does not.
    public let localId: String
    public let phase: SessionPhase
    /// «perche»: one plain sentence, the same the notch shows (what went wrong, what is asked). May be empty.
    public let why: String
    /// When the session entered this state: the timer counts from here.
    public let since: Date?
    /// «cosa»: for `aspetta_altro`, what it waits for, in short.
    public let what: String
    /// «visto»: the session's last sign of life; the newest file wins when a /clear left two for one session.
    public let seen: Date?

    public init(cli: String, localId: String = "", phase: SessionPhase, why: String = "", since: Date? = nil, what: String = "", seen: Date? = nil) {
        (self.cli, self.localId, self.phase, self.why, self.since, self.what, self.seen) = (cli, localId, phase, why, since, what, seen)
    }
}

extension GoalSources {
    /// nil for a file with no known `stato`: the row then falls back to what its activity says.
    public static func parseMotor(_ data: Data, cli: String) -> SessionMotor? {
        guard let d = object(data), let raw = d["stato"] as? String, let phase = SessionPhase(contract: raw) else { return nil }
        func line(_ key: String) -> String { (d[key] as? String ?? "").split(whereSeparator: \.isWhitespace).joined(separator: " ") }
        let file = (d["cli"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? cli
        return SessionMotor(cli: file, localId: line("local_id"), phase: phase, why: line("perche"), since: date(d["da"]),
                            what: line("cosa"), seen: date(d["visto"]))
    }
}
