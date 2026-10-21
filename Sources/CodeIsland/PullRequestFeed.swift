import Foundation
import CodeIslandCore

/// The pull requests under the goals, read from GitHub through the `gh` already signed in on this Mac
/// (no token is asked or stored). Only OPEN PRs are published (`openByGoal`); a PR seen merged for the
/// first time comes once in `mergedToAnimate`, then goes (`PRTracker` holds the rules). Asked once for all
/// PRs, and only when the notch opens or when a session file changed the set of PRs. Never on a timer.
/// A failed ask keeps the last good state and the time it was read, so the view can say how old it is.
@MainActor final class PullRequestFeed: ObservableObject {
    static let shared = PullRequestFeed()
    /// shortcut: one query holds at most this many PRs (the first ones), upgrade with pagination if goals ever carry more.
    private static let maxRefs = 100
    private static let seenKey = "goalnotch.seenMergedPRs"  // "owner/repo#number"

    /// Goal cli -> its open PRs with state (green, pending, red, conflict).
    @Published private(set) var openByGoal: [String: [PRInfo]] = [:]
    /// Merges the user has not seen yet, oldest first. The view plays the animation once for each, then calls
    /// `mergedAnimationShown`; the tracker already remembers it on disk, so a restart never plays it again.
    @Published private(set) var mergedToAnimate: [PRInfo] = []
    /// When `openByGoal` was read; nil until the first success.
    @Published private(set) var fetchedAt: Date?
    @Published private(set) var lastFetchFailed = false
    private var byGoal: [String: [SessionPR]] = [:]
    private var tracker = PRTracker(seen: Set((UserDefaults.standard.stringArray(forKey: seenKey) ?? []).compactMap(PullRequestFeed.ref)))
    private var inFlight = false

    /// Called with every board reload; asks GitHub only when the PRs of the goals changed.
    func track(_ next: [String: [SessionPR]]) {
        guard next != byGoal else { return }
        byGoal = next
        refresh()
    }

    /// The merges waiting to be shown that belong to this goal (a promotion PR belongs to many goals).
    func merged(for goal: String) -> [PRInfo] {
        let refs = Set((byGoal[goal] ?? []).map(\.ref))
        return mergedToAnimate.filter { refs.contains($0.ref) }
    }

    func mergedAnimationShown(_ ref: PRRef) { mergedToAnimate.removeAll { $0.ref == ref } }

    func refresh() {
        guard !inFlight else { return }
        let goals = byGoal
        let seenBefore = tracker.seen.count
        let asked = Array(tracker.toAsk(goals).prefix(Self.maxRefs))
        inFlight = true
        Task {
            // Nothing to ask (the sessions call everything finished) still settles, so the launch baseline ends.
            let answers: [PRRef: PRInfo]? = asked.isEmpty ? [:] : await Self.ask(asked)
            inFlight = false
            guard let answers else { lastFetchFailed = true; return }
            let out = tracker.settle(byGoal, answers: answers)
            if out.open != openByGoal { openByGoal = out.open }
            mergedToAnimate += out.merged
            if !out.merged.isEmpty { VoiceAlertCenter.shared.merged(out.merged) }
            if tracker.seen.count != seenBefore {
                UserDefaults.standard.set(tracker.seen.sorted().map { "\($0.repo)#\($0.number)" }, forKey: Self.seenKey)
            }
            fetchedAt = Date()
            lastFetchFailed = false
            if byGoal != goals { refresh() }  // the PRs changed while this ask ran
        }
    }

    private nonisolated static func ref(_ key: String) -> PRRef? {
        guard let hash = key.lastIndex(of: "#"), let n = Int(key[key.index(after: hash)...]) else { return nil }
        return PRRef(repo: String(key[..<hash]), number: n)
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
