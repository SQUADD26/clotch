import Foundation
import CodeIslandCore

/// State of the pull requests under the goals, read from GitHub through the `gh` already signed in on
/// this Mac (no token is asked or stored). Asked once for all PRs, and only when the notch opens or when
/// the set of PRs of the goals changed (a session file named a new one). Never on a timer. A failed
/// ask keeps the last good state and the time it was read, so the view can say how old it is.
@MainActor final class PullRequestFeed: ObservableObject {
    static let shared = PullRequestFeed()
    /// shortcut: one query holds at most this many PRs (the first ones, oldest repos first), upgrade with pagination if goals ever carry more.
    private static let maxRefs = 100

    @Published private(set) var infos: [PRRef: PRInfo] = [:]
    /// When `infos` was read; nil until the first success.
    @Published private(set) var fetchedAt: Date?
    @Published private(set) var lastFetchFailed = false
    private var refs: [PRRef] = []
    private var inFlight = false

    /// Called with every board reload; asks GitHub only when the set of PRs changed.
    func track(_ byGoal: [String: [PRRef]]) {
        let next = Array(Set(byGoal.values.joined()).sorted().prefix(Self.maxRefs))
        guard next != refs else { return }
        refs = next
        refresh()
    }

    func refresh() {
        guard !inFlight, !refs.isEmpty else { return }
        inFlight = true
        let asked = refs
        Task {
            let out = await Self.ask(asked)
            inFlight = false
            if let out {
                if out != infos { infos = out }
                fetchedAt = Date()
                lastFetchFailed = false
            } else {
                lastFetchFailed = true
            }
        }
    }

    /// `gh api graphql`, off the main thread. gh exits non-zero when GraphQL reports an error for one PR
    /// but still prints the partial data, so the answer is judged by its content, not its exit code.
    private nonisolated static func ask(_ refs: [PRRef]) async -> [PRRef: PRInfo]? {
        await Task.detached { () -> [PRRef: PRInfo]? in
            guard let gh = ["/opt/homebrew/bin/gh", "/usr/local/bin/gh", "/usr/bin/gh"].first(where: FileManager.default.isExecutableFile(atPath:)) else { return nil }
            let process = Process(), pipe = Pipe()
            process.executableURL = URL(fileURLWithPath: gh)
            process.arguments = ["api", "graphql", "-f", "query=\(PullRequests.query(refs))"]
            process.environment = ProcessInfo.processInfo.environment.merging(["GH_PROMPT_DISABLED": "1", "NO_COLOR": "1"]) { _, new in new }
            process.standardOutput = pipe
            process.standardError = FileHandle.nullDevice
            guard (try? process.run()) != nil else { return nil }
            let killer = DispatchWorkItem { if process.isRunning { process.terminate() } }
            DispatchQueue.global().asyncAfter(deadline: .now() + 20, execute: killer)
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit()
            killer.cancel()
            return PullRequests.parse(response: data, refs: refs)
        }.value
    }
}
