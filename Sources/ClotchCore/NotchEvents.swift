import Foundation

// What the collapsed notch announces about goals: a change between two loads. Requests taken in
// charge come from GoalStore.takenToAnimate. Pure: the caller keeps the previous load and passes both.

public struct NotchEvent: Identifiable, Equatable, Sendable {
    public enum Kind: Equatable, Sendable { case proofDone, still, blocked, reached, confirmed, requestTaken, prMerged }
    public let kind: Kind
    /// Goal id (`GoalRow.id`) or request id (`UserRequest.id`): the view reads the live data from it.
    public let subject: String
    /// Proofs done when the event fired, so two proofs in a row are two events; the PR number for `prMerged`.
    public let count: Int
    /// What the line says when no live data names it: the PR title for `prMerged`.
    public let text: String

    public init(kind: Kind, subject: String, count: Int, text: String = "") {
        self.kind = kind
        self.subject = subject
        self.count = count
        self.text = text
    }

    public var id: String { "\(kind)-\(subject)-\(count)" }
}

public enum NotchEvents {
    /// How long a notification stays after its change lands, in seconds: reading time by the length of its text.
    public static let minHold = 3.5
    public static let maxHold = 8.0
    public static let holdPerCharacter = 0.1
    /// Roberto asked for 3 s more to read what was taken in charge (#39).
    public static let extraHold = 3.0

    public static func hold(forText text: String) -> Double {
        min(max(Double(text.count) * holdPerCharacter, minHold), maxHold) + extraHold
    }

    /// What the closed notch says where the goal chased now stands, while the event is up (#39):
    /// «Presa in carico: <request> · <session>». nil = the event has only its line under the notch.
    public static func notice(_ kind: NotchEvent.Kind, title: String, by session: String = "", done: Bool = false) -> String? {
        let head: String
        switch kind {
        case .requestTaken: head = done ? "Fatta" : "Presa in carico"
        case .confirmed: head = "Obiettivo confermato"
        case .reached: head = "Obiettivo raggiunto"
        default: return nil
        }
        // The title is clipped first so the session's name still shows.
        return "\(head): \(clip(title, 40))" + (session.isEmpty ? "" : " · \(clip(session, 24))")
    }

    static func clip(_ s: String, _ n: Int) -> String { s.count > n ? String(s.prefix(n - 1)) + "…" : s }

    public static func goals(old: [GoalRow], new: [GoalRow]) -> [NotchEvent] {
        let before = Dictionary(old.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        return new.compactMap { row in
            let event = { (kind: NotchEvent.Kind) in NotchEvent(kind: kind, subject: row.id, count: row.proofsDone) }
            // A goal that appears is not news: only a change of a known goal is.
            // A proposed goal is not chased yet, a closed session's goal is over: they announce nothing.
            guard let prev = before[row.id], !row.proposed, !row.closed else { return nil }
            if prev.proposed { return event(.confirmed) }
            switch (prev.status, row.status) {
            case (.reached, .reached), (.blocked, .blocked), (.still, .still): break
            case (_, .reached): return event(.reached)
            case (_, .blocked): return event(.blocked)
            case (_, .still): return event(.still)
            default: break
            }
            return row.proofsDone > prev.proofsDone ? event(.proofDone) : nil
        }
    }
}
