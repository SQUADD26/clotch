import Foundation

// The summary of the session strip (clotch#114, Figma «Stato delle sessioni»), on its right. Pure, so it is tested.

extension GoalBoard {
    /// «1 problema · 1 aspetta te», else «2 aspettano te», else «Tutte al lavoro». Red beats yellow beats grey.
    public static func sessionSummary(_ rows: [GoalRow]) -> (text: String, tone: SessionTone) {
        let problems = rows.filter { $0.tone == .problem }.count
        let waiting = rows.filter { $0.tone == .attention }.count
        var parts: [String] = []
        if problems > 0 { parts.append(problems == 1 ? "1 problema" : "\(problems) problemi") }
        if waiting > 0 { parts.append(waiting == 1 ? "1 aspetta te" : "\(waiting) aspettano te") }
        if !parts.isEmpty { return (parts.joined(separator: " · "), problems > 0 ? .problem : .attention) }
        let working = rows.filter { $0.phase == .lavora }.count
        if working == rows.count, working > 0 { return ("Tutte al lavoro", .quiet) }
        return (working == 0 ? "Nessuna al lavoro" : "\(working) su \(rows.count) al lavoro", .quiet)
    }
}
