import Foundation

// What the collapsed notch announces: a change between two loads of the goals or of the requests.
// Pure: the caller keeps the previous load and passes both.

public struct NotchEvent: Identifiable, Equatable, Sendable {
    public enum Kind: Equatable, Sendable { case opened, proofDone, still, blocked, reached, requestTaken }
    public let kind: Kind
    /// Goal id (`GoalRow.id`) or request id (`UserRequest.id`): the view reads the live data from it.
    public let subject: String
    /// Proofs done when the event fired, so two proofs in a row are two events.
    public let count: Int

    public var id: String { "\(kind)-\(subject)-\(count)" }
}

public enum NotchEvents {
    public static func goals(old: [GoalRow], new: [GoalRow]) -> [NotchEvent] {
        let before = Dictionary(old.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        return new.compactMap { row in
            let event = { (kind: NotchEvent.Kind) in NotchEvent(kind: kind, subject: row.id, count: row.proofsDone) }
            guard let prev = before[row.id] else {
                if case .reached = row.status { return nil }
                return event(.opened)
            }
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

    public static func requests(old: [UserRequest], new: [UserRequest]) -> [NotchEvent] {
        let takenBefore = Set(old.filter(\.taken).map(\.id))
        return new.filter { $0.taken && !takenBefore.contains($0.id) }
            .map { NotchEvent(kind: .requestTaken, subject: $0.id, count: 0) }
    }
}
