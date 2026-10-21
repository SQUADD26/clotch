import Foundation

/// Which PRs the notch shows and when a merge is news (Roberto, issue #6): only OPEN PRs stay on screen;
/// a PR seen merged for the first time is returned once as an event, then dropped; closed-unmerged ones
/// vanish silently. `seen` is the set of merged PRs already shown, kept on disk by the caller. The first
/// pass after launch is a baseline: everything already merged goes to `seen` with no event, so a launch never bursts.
/// Pure state machine: no I/O, no clock.
public struct PRTracker: Sendable {
    public private(set) var seen: Set<PRRef>
    private var baseline = true

    public init(seen: Set<PRRef> = []) { self.seen = seen }

    /// The PRs to ask GitHub about: every one the sessions do not already call finished, plus a merged one not seen yet
    /// (its title, and a confirmation of the merge). The app's own MERGED state is trusted: MERGED never goes back.
    public mutating func toAsk(_ byGoal: [String: [SessionPR]]) -> [PRRef] {
        var ask = Set<PRRef>()
        for p in byGoal.values.joined() {
            if p.state == "CLOSED" { continue }
            if p.state != "MERGED" { ask.insert(p.ref) }
            else if baseline { seen.insert(p.ref) }
            else if !seen.contains(p.ref) { ask.insert(p.ref) }
        }
        return ask.sorted()
    }

    /// `answers` = GitHub's state of the asked PRs (a missing one is unknown and dropped). Returns the open PRs by goal and
    /// the merges that are news now. Call it only with a good answer: a failed ask keeps what was shown.
    public mutating func settle(_ byGoal: [String: [SessionPR]], answers: [PRRef: PRInfo]) -> (open: [String: [PRInfo]], merged: [PRInfo]) {
        var merged: [PRInfo] = []
        for info in answers.values.sorted(by: { $0.ref < $1.ref }) where info.state == .merged && seen.insert(info.ref).inserted {
            if !baseline { merged.append(info) }
        }
        baseline = false
        let open = byGoal.mapValues { list in
            list.compactMap { answers[$0.ref] }.filter { [.green, .pending, .red, .conflict].contains($0.state) }
        }.filter { !$0.value.isEmpty }
        return (open, merged)
    }
}
