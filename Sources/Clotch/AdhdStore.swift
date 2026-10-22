import Foundation
import ClotchCore

/// The ADHD tab's data: `richieste.py adhd` (claude-config#1927), read while the notch is open: on opening and every 10 s.
/// «Letta» and «Sollecita» go back through the same command; the list changes at once, the next read confirms it.
@MainActor
final class AdhdStore: ObservableObject {
    static let shared = AdhdStore()
    @Published private(set) var items: [AdhdRequest] = []
    /// The engine's command that failed, as one sentence (#263): the card may be old. A read that works clears its own; an action's stays until the next action.
    @Published private var readError: String?
    @Published private var actionError: String?
    var error: String? { actionError ?? readError }
    private var timer: Timer?
    private var reading = false
    private let home = FileManager.default.homeDirectoryForCurrentUser.path

    var unanswered: Int { AdhdRequest.unansweredCount(items) }

    func start() {
        refresh()
        guard timer == nil else { return }
        timer = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.refresh() }
        }
    }

    func stop() { timer?.invalidate(); timer = nil }

    func refresh() {
        guard !reading else { return }
        reading = true
        let args = [home + "/.claude/hooks/richieste.py", "adhd"]
        Task.detached {
            let result = EngineCommand.python(args)
            await MainActor.run {
                self.reading = false
                switch result {
                case .success(let data):
                    self.readError = nil
                    let list = GoalSources.parseAdhd(data)
                    if list != self.items { self.items = list }
                case .failure(let failure): self.readError = failure.message
                }
            }
        }
    }

    /// One answered question, or all of them with nil: gone from the list.
    func markRead(_ id: String?) {
        let commands = AdhdRequest.markReadArguments(id, in: items, home: home)
        items.removeAll { $0.answered && (id == nil || $0.id == id) }
        Task.detached {
            let failed = commands.compactMap(Self.failure).first
            await MainActor.run { self.actionError = failed; self.refresh() }
        }
    }

    func nudge(_ id: String) {
        if let i = items.firstIndex(where: { $0.id == id }) { items[i].nudged = true }
        act("sollecita", id)
    }

    private func act(_ verb: String, _ arg: String) {
        let args = [home + "/.claude/hooks/richieste.py", verb, arg]
        Task.detached {
            let failed = Self.failure(args)
            await MainActor.run { self.actionError = failed; self.refresh() }
        }
    }

    /// The sentence if the command failed (the log has the stderr), nil if it worked.
    private nonisolated static func failure(_ args: [String]) -> String? {
        if case .failure(let failure) = EngineCommand.python(args) { return failure.message }
        return nil
    }
}
