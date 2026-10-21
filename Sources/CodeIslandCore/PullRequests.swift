import Foundation

// Pure logic for the pull requests under each goal: which PRs belong to a goal, the GitHub query
// for all of them at once, and the state mapping. No I/O: the app's `PullRequestFeed` runs the query.

public struct PRRef: Hashable, Sendable, Comparable {
    public let repo: String  // owner/name
    public let number: Int
    public static func < (a: PRRef, b: PRRef) -> Bool { (a.repo, a.number) < (b.repo, b.number) }
}

public enum PRState: Equatable, Sendable {
    case merged, closed   // closed = closed without merge
    case green, pending, red, conflict  // open: checks passed / running / failed; cannot merge
}

public struct PRInfo: Equatable, Sendable {
    public let ref: PRRef
    public let title: String
    public let url: String
    public let state: PRState
}

public enum PullRequests {
    // MARK: Which PRs belong to a goal

    private static let linkPattern = try! NSRegularExpression(pattern: #"github\.com/([\w.-]+/[\w.-]+)/pull/(\d+)"#)
    private static let hashPattern = try! NSRegularExpression(pattern: #"(?<![\w/&])#(\d{1,6})\b"#)

    /// PR links in free text, in order.
    static func links(in text: String) -> [PRRef] {
        let ns = text as NSString
        return linkPattern.matches(in: text, range: NSRange(location: 0, length: ns.length)).compactMap { m in
            Int(ns.substring(with: m.range(at: 2))).map { PRRef(repo: ns.substring(with: m.range(at: 1)), number: $0) }
        }
    }

    /// The `prs` field of a session file. Tolerant: a link string, or an object with a link
    /// (`url`/`html_url`/`prUrl`) or a `number` plus a repo (`repo`/`repository`/`nameWithOwner`); a list of either.
    /// Anything without a repo is dropped: it cannot be asked of GitHub.
    public static func parse(_ raw: Any?) -> [PRRef] {
        switch raw {
        case let s as String: return links(in: s)
        case let list as [Any]: return list.flatMap { parse($0) }
        case let d as [String: Any]:
            let linked = ["url", "html_url", "prUrl"].compactMap { d[$0] as? String }.flatMap(links)
            if !linked.isEmpty { return linked }
            let repo = ["repo", "repository", "nameWithOwner"].compactMap { d[$0] as? String }.first { $0.split(separator: "/").count == 2 }
            guard let repo, let n = d["number"] as? Int else { return [] }
            return [PRRef(repo: repo, number: n)]
        default: return []
        }
    }

    /// `#N` in a goal's proofs names a PR only when the family's PRs live in one repo (an issue number
    /// simply comes back unknown from GitHub and is dropped).
    /// shortcut: a bare #N in a goal spanning several repos is ignored, upgrade if proofs start naming the repo.
    static func refs(inProofs texts: [String], sessionRefs: [PRRef]) -> [PRRef] {
        let repos = Set(sessionRefs.map(\.repo))
        return texts.flatMap { t -> [PRRef] in
            var out = links(in: t)
            if repos.count == 1, let repo = repos.first {
                let ns = t as NSString
                out += hashPattern.matches(in: t, range: NSRange(location: 0, length: ns.length)).compactMap { m in
                    Int(ns.substring(with: m.range(at: 1))).map { PRRef(repo: repo, number: $0) }
                }
            }
            return out
        }
    }

    /// goal cli -> its PRs, unique, sorted: the family's session `prs` (archived children too: their PRs are the merged ones)
    /// plus PR links and `#N` in the goal's proofs.
    public static func byGoal(goals: [GoalRecord], sessions: [DesktopSession]) -> [String: [PRRef]] {
        let masters = GoalBoard.index(sessions)
        let children = Dictionary(grouping: sessions.filter { $0.parentLocalId != nil }, by: { $0.parentLocalId! })
        var out: [String: [PRRef]] = [:]
        for g in goals where GoalBoard.shown.contains(g.state) {
            let master = masters[g.cli] ?? g.successor.flatMap { masters[$0] }
            let own = GoalBoard.family(of: master, children: children, includeArchived: true).flatMap(\.prs)
            let texts = (g.proofs ?? []).map(\.text) + [g.proof]
            let all = Set(own + refs(inProofs: texts, sessionRefs: own)).sorted()
            if !all.isEmpty { out[g.cli] = all }
        }
        return out
    }

    // MARK: State from GitHub

    /// Merged and closed first; then a PR that cannot merge (its checks do not run on a conflict);
    /// then checks. No checks at all counts as green: nothing is failing or running.
    public static func state(_ state: String, mergeable: String?, checks: String?) -> PRState {
        if state == "MERGED" { return .merged }
        if state == "CLOSED" { return .closed }
        if mergeable == "CONFLICTING" { return .conflict }
        switch checks {
        case "FAILURE", "ERROR": return .red
        case "PENDING", "EXPECTED": return .pending
        default: return .green
        }
    }

    private static let name = try! NSRegularExpression(pattern: #"^[\w.-]+$"#)

    /// One GraphQL query for all PRs, aliased `p<index>`. A ref whose owner or name is not a plain
    /// GitHub name is skipped (its alias is simply absent), so nothing odd reaches the query text.
    public static func query(_ refs: [PRRef]) -> String {
        let fields = "number title url state mergeable commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }"
        let body = refs.enumerated().compactMap { i, r -> String? in
            let parts = r.repo.split(separator: "/").map(String.init)
            guard parts.count == 2, parts.allSatisfy({ name.firstMatch(in: $0, range: NSRange(location: 0, length: ($0 as NSString).length)) != nil }) else { return nil }
            return "p\(i): repository(owner: \"\(parts[0])\", name: \"\(parts[1])\") { pullRequest(number: \(r.number)) { \(fields) } }"
        }
        return "query { \(body.joined(separator: " ")) }"
    }

    /// `gh api graphql` output for `query(refs)`. GraphQL errors (a number that is an issue, a repo Roberto cannot see)
    /// come with partial data: those refs are just absent. nil = not a GraphQL answer at all.
    public static func parse(response data: Data, refs: [PRRef]) -> [PRRef: PRInfo]? {
        guard let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let payload = root["data"] as? [String: Any] else { return nil }
        var out: [PRRef: PRInfo] = [:]
        for (i, ref) in refs.enumerated() {
            guard let pr = ((payload["p\(i)"] as? [String: Any])?["pullRequest"]) as? [String: Any],
                  let state = pr["state"] as? String else { continue }
            let nodes = (pr["commits"] as? [String: Any])?["nodes"] as? [[String: Any]]
            let checks = (((nodes?.first?["commit"] as? [String: Any])?["statusCheckRollup"]) as? [String: Any])?["state"] as? String
            out[ref] = PRInfo(ref: ref, title: pr["title"] as? String ?? "", url: pr["url"] as? String ?? "",
                              state: Self.state(state, mergeable: pr["mergeable"] as? String, checks: checks))
        }
        return out
    }
}
