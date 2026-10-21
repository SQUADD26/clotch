/// A goal being rewritten in place from the notch (#66): `draft` is nil when nothing is being edited.
/// Save hands back the text to write (`GoalStore.write`, which skips an empty or unchanged one) and closes; cancel only closes.
public struct GoalEdit: Equatable {
    public var draft: String?

    public init() {}

    public var isEditing: Bool { draft != nil }
    public mutating func begin(_ text: String) { draft = text }
    public mutating func save() -> String? { defer { draft = nil }; return draft }
    public mutating func cancel() { draft = nil }
}
