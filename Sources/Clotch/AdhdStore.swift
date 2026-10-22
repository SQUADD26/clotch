import Foundation
import ClotchCore

/// The ADHD tab's data: `richieste.py adhd` (claude-config#1927), read while the notch is open: on opening and every 10 s.
/// «Letta» and «Sollecita» go back through the same command; the list changes at once, the next read confirms it.
@MainActor
final class AdhdStore: ObservableObject {
    static let shared = AdhdStore()
    @Published private(set) var items: [AdhdRequest] = []
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
            let list = Self.run(args).map(GoalSources.parseAdhd)
            await MainActor.run {
                self.reading = false
                if let list, list != self.items { self.items = list }
            }
        }
    }

    /// One answered question, or all of them with nil: gone from the list.
    func markRead(_ id: String?) {
        let commands = AdhdRequest.markReadArguments(id, in: items, home: home)
        items.removeAll { $0.answered && (id == nil || $0.id == id) }
        Task.detached {
            for args in commands { _ = Self.run(args) }
            await MainActor.run { self.refresh() }
        }
    }

    func nudge(_ id: String) {
        if let i = items.firstIndex(where: { $0.id == id }) { items[i].nudged = true }
        act("sollecita", id)
    }

    private func act(_ verb: String, _ arg: String) {
        let args = [home + "/.claude/hooks/richieste.py", verb, arg]
        Task.detached {
            _ = Self.run(args)
            await MainActor.run { self.refresh() }
        }
    }

    /// stdout of the script, nil if it did not run or failed.
    private nonisolated static func run(_ args: [String]) -> Data? {
        guard let py = ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"]
            .first(where: FileManager.default.isExecutableFile(atPath:)) else { return nil }
        let process = Process(), out = Pipe()
        process.executableURL = URL(fileURLWithPath: py)
        process.arguments = args
        var env = ProcessInfo.processInfo.environment
        env["CLAUDE_CODE_SESSION_ID"] = nil  // Roberto, not a session: with it the command may refuse
        process.environment = env
        process.standardInput = FileHandle.nullDevice
        process.standardOutput = out
        process.standardError = FileHandle.nullDevice
        guard (try? process.run()) != nil else { return nil }
        let data = out.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        return process.terminationStatus == 0 ? data : nil
    }
}
