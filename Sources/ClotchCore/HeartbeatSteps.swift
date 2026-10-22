import Foundation

/// The Overseer heartbeat's steps (claude-config#2031): `~/.config/coda-overseer/battito/passi.json`,
/// `{"<passo>": {"ok": <epoch of the last success>, "falliti": <beats failed in a row>, "errore": "<text>"}}`.
/// A step failed `stuckAfter` beats in a row gets one notice in the notch (#184). Pure: the caller keeps the previous read.
public enum HeartbeatSteps {
    public struct Step: Equatable, Sendable {
        public let ok: Int
        public let failed: Int
        public let error: String
    }

    /// The engine's `PASSI_FERMI`.
    public static let stuckAfter = 3

    /// nil = no file or not the engine's shape: nothing to say.
    public static func parse(_ data: Data) -> [String: Step]? {
        guard let all = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return all.compactMapValues { v in
            guard let d = v as? [String: Any] else { return nil }
            return Step(ok: (d["ok"] as? NSNumber)?.intValue ?? 0, failed: (d["falliti"] as? NSNumber)?.intValue ?? 0,
                        error: d["errore"] as? String ?? "")
        }
    }

    /// One event when a step crosses into stuck (at launch too: a step already stuck is news once).
    /// `count` = the last success, so a new streak after a recovery is a new event; `text` is the whole line.
    public static func stuck(old: [String: Step], new: [String: Step]) -> [NotchEvent] {
        new.filter { $0.value.failed >= stuckAfter && (old[$0.key]?.failed ?? 0) < stuckAfter }
            .sorted { $0.key < $1.key }
            .map { NotchEvent(kind: .stepStuck, subject: $0.key, count: $0.value.ok, text: line($0.key, failed: $0.value.failed)) }
    }

    static func line(_ step: String, failed: Int) -> String {
        "Overseer: «\(step.replacingOccurrences(of: "_", with: " "))» non riesce da \(failed) giri"
    }
}
