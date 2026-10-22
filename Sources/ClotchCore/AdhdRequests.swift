import Foundation

/// One entry of `richieste.py adhd` (claude-config#1927): a question of Roberto's rewritten clear, repeats merged.
/// Read-only like the other feeds; the two actions («letta», «sollecita») go back through the same command.
public struct AdhdRequest: Identifiable, Equatable, Sendable {
    public let id: String
    public let times: Int            // `volte`: how often it was asked
    public let at: Date?
    public let question: String      // `domanda_chiara`
    public let answer: String        // "" while there is none
    public let responsible: String
    public let origin: String
    public let toSort: Bool          // `da_smistare`: no session to ask yet, the Overseer sorts it
    public var nudged: Bool          // `stato` "sollecitata"

    public var answered: Bool { !answer.isEmpty }

    /// The yellow line under an unanswered question.
    public var waitingLabel: String {
        toSort ? "Da smistare · Overseer" : "In attesa di \([responsible, origin].first { !$0.isEmpty } ?? "una sessione")"
    }

    /// The number in the tab: the questions still without an answer.
    public static func unansweredCount(_ all: [AdhdRequest]) -> Int { all.filter { !$0.answered }.count }

    /// Arguments for `python3`: `richieste.py letta <id>|--tutte`, `richieste.py sollecita <id>`.
    public static func arguments(_ verb: String, _ id: String?, home: String) -> [String] {
        [home + "/.claude/hooks/richieste.py", verb] + (id.map { [$0] } ?? [])
    }
}

extension GoalSources {
    /// The JSON array `richieste.py adhd` prints; anything else is "no data", never an error.
    public static func parseAdhd(_ data: Data) -> [AdhdRequest] {
        guard let list = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] else { return [] }
        return list.compactMap { d in
            guard let id = d["id"] as? String, !id.isEmpty,
                  let question = (d["domanda_chiara"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !question.isEmpty else { return nil }
            return AdhdRequest(id: id, times: d["volte"] as? Int ?? 1, at: date(d["t"]), question: question,
                               answer: (d["risposta"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines),
                               responsible: d["responsabile"] as? String ?? "", origin: d["origine"] as? String ?? "",
                               toSort: d["da_smistare"] as? Bool ?? false, nudged: d["stato"] as? String == "sollecitata")
        }
    }
}
