import Foundation

/// The notice before a script takes Roberto's screen (clotch#292, claude-config#2278). The engine writes two lines in
/// `~/.config/voce/eventi.jsonl` from one shared point that every UI script calls: `schermo_in_arrivo` (`t`, `tra_ms`, `da`) and,
/// when the script is done, `schermo_libero` (`t`, `da`). The script waits `tra_ms` after the first; Clotch only draws the countdown.
/// Never spoken: the voice ignores both types (`VoiceEvents.newer`).
public enum ScreenNotice {
    public enum Phase: Equatable, Sendable {
        /// The countdown: the bar empties from `total` to 0 at `deadline`.
        case incoming(deadline: Date, total: TimeInterval)
        /// «Schermo libero», held until `until`.
        case free(until: Date)
    }

    public static let types: Set<String> = ["schermo_in_arrivo", "schermo_libero"]
    /// A script that died without writing `schermo_libero` stops counting as «still using the screen» after this.
    static let staleAfter: TimeInterval = 60

    /// What the notch shows at `now`, from the tail of eventi.jsonl. Each script (`da`) counts by its last line; several scripts
    /// at once make one notice: the countdown that ends last, then nothing while any still works, then «Schermo libero» once all are done.
    public static func phase(in data: Data, now: Date, freeHold: TimeInterval) -> Phase? {
        var last: [String: (at: Date, total: TimeInterval?)] = [:]  // total != nil = in arrivo
        for line in String(decoding: data, as: UTF8.self).split(separator: "\n") {
            guard let o = (try? JSONSerialization.jsonObject(with: Data(line.utf8))) as? [String: Any],
                  let type = o["tipo"] as? String, types.contains(type), let at = GoalSources.date(o["t"]) else { continue }
            let total = type == "schermo_in_arrivo" ? max(0, (o["tra_ms"] as? NSNumber)?.doubleValue ?? 1500) / 1000 : nil
            last[o["da"] as? String ?? ""] = (at, total)
        }
        var incoming: Phase?
        var working = false
        var freed: Date?
        for (at, total) in last.values {
            if let total {
                guard now.timeIntervalSince(at) < staleAfter else { continue }
                working = true
                let deadline = at.addingTimeInterval(total)
                if deadline > now, case .incoming(let d, _)? = incoming, d >= deadline { continue }
                if deadline > now { incoming = .incoming(deadline: deadline, total: total) }
            } else if freed.map({ at > $0 }) ?? true { freed = at }
        }
        if let incoming { return incoming }
        if working { return nil }
        if let freed, now.timeIntervalSince(freed) < freeHold, freed <= now { return .free(until: freed.addingTimeInterval(freeHold)) }
        return nil
    }
}
