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

    /// How the notch draws it (Figma «Stato delle sessioni»): grey while it works, waits for something else or stands
    /// still; yellow when it waits for Roberto; red for a problem. No dots: only the name's colour.
    public var tone: SessionTone {
        switch self {
        case .aspettaRoberto: return .attention
        case .problema: return .problem
        case .lavora, .aspettaAltro, .ferma: return .quiet
        }
    }
}

public enum SessionTone: Sendable { case quiet, attention, problem }

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
    /// «muove»: for `ferma`, who has to move it (`roberto` | `overseer`).
    public let mover: String

    public init(cli: String, localId: String = "", phase: SessionPhase, why: String = "", since: Date? = nil, what: String = "", seen: Date? = nil, mover: String = "") {
        (self.cli, self.localId, self.phase, self.why, self.since, self.what, self.seen, self.mover) = (cli, localId, phase, why, since, what, seen, mover)
    }

    /// The phase's tone, except a still session that only Roberto can move: it waits for him, so yellow.
    public var tone: SessionTone { phase == .ferma && mover == "roberto" ? .attention : phase.tone }
}

extension GoalSources {
    /// nil for a file with no known `stato`: the row then falls back to what its activity says.
    public static func parseMotor(_ data: Data, cli: String) -> SessionMotor? {
        guard let d = object(data), let raw = d["stato"] as? String, let phase = SessionPhase(contract: raw) else { return nil }
        func line(_ key: String) -> String { (d[key] as? String ?? "").split(whereSeparator: \.isWhitespace).joined(separator: " ") }
        let file = (d["cli"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? cli
        return SessionMotor(cli: file, localId: line("local_id"), phase: phase, why: line("perche"), since: date(d["da"]),
                            what: line("cosa"), seen: date(d["visto"]), mover: line("muove"))
    }
}
