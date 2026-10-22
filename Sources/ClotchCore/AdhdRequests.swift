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
    public let toSort: Bool          // `da_smistare`: no session to ask yet, the Friday sorts it
    public var nudged: Bool          // `stato` "sollecitata"
    // The rest of the engine's contract (#166): who answered and which session owes the answer.
    public var answeredBy: String = ""   // `risposta_da`: sessione | ereditata | haiku
    public var state: String = ""        // `stato`: aperta | con_risposta | sollecitata
    public var localId: String = ""      // `local_id`: app id of the session that must answer, "" when unknown
    public var session: String = ""      // `sessione`: its cli id
    public var sessionTitle: String = "" // `titolo_sessione`
    public var ids: [String] = []        // `ids`: the repeats merged into this entry
    public var nudgedAt: Date? = nil     // `t_sollecito`

    /// Under an answer that did not come from the session itself: Haiku's fallback is not the real one, an inherited one was given before.
    public var answerNote: String? {
        switch answeredBy { case "haiku": "Risposta provvisoria"; case "ereditata": "Già risposta prima"; default: nil }
    }

    public var answered: Bool { !answer.isEmpty }

    /// The yellow line under an unanswered question.
    public var waitingLabel: String {
        nudged ? "Sollecitata · aspetto la risposta" : toSort ? "Da smistare · Friday" : "In attesa di \([responsible, origin].first { !$0.isEmpty }?.asFriday ?? "una sessione")"
    }

    /// The number in the tab: the questions still without an answer.
    public static func unansweredCount(_ all: [AdhdRequest]) -> Int { all.filter { !$0.answered }.count }

    /// One `letta <id>` per answered question shown (or just `id`): never `--tutte`, which would also mark an answer that landed
    /// after the list was drawn (#171).
    public static func markReadArguments(_ id: String?, in shown: [AdhdRequest], home: String) -> [[String]] {
        shown.filter { $0.answered && (id == nil || $0.id == id) }.map { arguments("letta", $0.id, home: home) }
    }

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
                               toSort: d["da_smistare"] as? Bool ?? false, nudged: d["stato"] as? String == "sollecitata",
                               answeredBy: d["risposta_da"] as? String ?? "", state: d["stato"] as? String ?? "",
                               localId: d["local_id"] as? String ?? "", session: d["sessione"] as? String ?? "",
                               sessionTitle: GoalBoard.clean(d["titolo_sessione"] as? String ?? ""),
                               ids: d["ids"] as? [String] ?? [], nudgedAt: date(d["t_sollecito"]))
        }
    }
}

/// What the ADHD tab shows (claude-config#1967): an empty card that could not be read is not «Nessuna domanda».
/// A failed read with a list already in hand keeps the list (it may be old; the yellow line says so).
public enum AdhdScreen: Equatable, Sendable {
    case list, empty, readFailed(String)

    public static func of(items: [AdhdRequest], readError: String?) -> AdhdScreen {
        if !items.isEmpty { return .list }
        return readError.map(AdhdScreen.readFailed) ?? .empty
    }
}
