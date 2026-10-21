import Foundation

// What the collapsed notch announces about goals: a change between two loads. Requests taken in
// charge come from GoalStore.takenToAnimate. Pure: the caller keeps the previous load and passes both.

public struct NotchEvent: Identifiable, Equatable, Sendable {
    public enum Kind: Equatable, Sendable { case proofDone, still, blocked, reached, requestTaken, prMerged }
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

    public static func hold(forText text: String) -> Double {
        min(max(Double(text.count) * holdPerCharacter, minHold), maxHold)
    }

    public static func goals(old: [GoalRow], new: [GoalRow]) -> [NotchEvent] {
        let before = Dictionary(old.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        return new.compactMap { row in
            let event = { (kind: NotchEvent.Kind) in NotchEvent(kind: kind, subject: row.id, count: row.proofsDone) }
            // A goal that appears is not news: only a change of a known goal is.
            // A proposed goal is not chased yet: it announces nothing.
            guard let prev = before[row.id], !row.proposed else { return nil }
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
