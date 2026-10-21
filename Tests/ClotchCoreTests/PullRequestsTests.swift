import XCTest
@testable import ClotchCore

final class PullRequestsTests: XCTestCase {
    private func node(_ state: String, _ mergeable: String, _ checks: String?) -> String {
        let rollup = checks.map { "{\"state\": \"\($0)\"}" } ?? "null"
        return """
        {"pullRequest": {"number": 1, "title": "t", "url": "https://github.com/o/r/pull/1", "state": "\(state)", "mergeable": "\(mergeable)",
         "commits": {"nodes": [{"commit": {"statusCheckRollup": \(rollup)}}]}}}
        """
    }

    func testStateMapping() {
        XCTAssertEqual(PullRequests.state("MERGED", mergeable: "UNKNOWN", checks: "FAILURE"), .merged)
        XCTAssertEqual(PullRequests.state("CLOSED", mergeable: "CONFLICTING", checks: nil), .closed)
        XCTAssertEqual(PullRequests.state("OPEN", mergeable: "MERGEABLE", checks: "SUCCESS"), .green)
        XCTAssertEqual(PullRequests.state("OPEN", mergeable: "MERGEABLE", checks: nil), .green, "no checks: nothing failing")
        XCTAssertEqual(PullRequests.state("OPEN", mergeable: "UNKNOWN", checks: "PENDING"), .pending)
        XCTAssertEqual(PullRequests.state("OPEN", mergeable: "MERGEABLE", checks: "FAILURE"), .red)
        XCTAssertEqual(PullRequests.state("OPEN", mergeable: "CONFLICTING", checks: "FAILURE"), .conflict, "conflict wins over red")
    }

    func testResponseKeepsPartialDataAndDropsMissing() throws {
        let refs = (1...6).map { PRRef(repo: "o/r", number: $0) }
        let json = """
        {"data": {"p0": \(node("MERGED", "UNKNOWN", "SUCCESS")), "p1": \(node("OPEN", "MERGEABLE", "SUCCESS")),
                  "p2": \(node("OPEN", "MERGEABLE", "PENDING")), "p3": \(node("OPEN", "MERGEABLE", "FAILURE")),
                  "p4": \(node("OPEN", "CONFLICTING", nil)), "p5": null},
         "errors": [{"type": "NOT_FOUND", "path": ["p5"]}]}
        """
        let got = try XCTUnwrap(PullRequests.parse(response: Data(json.utf8), refs: refs))
        XCTAssertEqual(refs.prefix(5).map { got[$0]?.state }, [.merged, .green, .pending, .red, .conflict])
        XCTAssertNil(got[refs[5]], "an issue number or an unseen repo is absent, not a failure")
        XCTAssertEqual(got[refs[0]]?.url, "https://github.com/o/r/pull/1")
        XCTAssertNil(PullRequests.parse(response: Data("not json".utf8), refs: refs))
        XCTAssertNil(PullRequests.parse(response: Data(#"{"errors": [{"message": "bad credentials"}]}"#.utf8), refs: refs))
    }

    func testQueryAliasesAndSkipsOddNames() {
        let q = PullRequests.query([PRRef(repo: "SQUADD26/clotch", number: 4), PRRef(repo: "a\" b/c", number: 5), PRRef(repo: "o/r", number: 7)])
        XCTAssertTrue(q.contains("p0: repository(owner: \"SQUADD26\", name: \"clotch\") { pullRequest(number: 4)"))
        XCTAssertFalse(q.contains("p1:"), "a name with a quote never reaches the query")
        XCTAssertTrue(q.contains("p2: repository(owner: \"o\", name: \"r\") { pullRequest(number: 7)"))
    }

    func testSessionPrsFieldShapes() {
        let url = "https://github.com/SQUADD26/clotch/pull/4"
        let real: [String: Any] = ["prNumber": 584, "repo": "SQUADD26/squadd-v2", "host": "github.com", "provider": "github",
                                   "url": "https://github.com/SQUADD26/squadd-v2/pull/584", "branch": "dev", "baseRef": "main", "state": "MERGED", "own": true]
        XCTAssertEqual(PullRequests.parse([real, ["prNumber": 1781, "repo": "SQUADD26/claude-config", "state": "OPEN"]] as [Any]),
                       [SessionPR(ref: PRRef(repo: "SQUADD26/squadd-v2", number: 584), state: "MERGED"),
                        SessionPR(ref: PRRef(repo: "SQUADD26/claude-config", number: 1781), state: "OPEN")])
        XCTAssertEqual(PullRequests.parse([url, ["url": "\(url)/files"], ["number": 9, "repo": "o/r"], ["number": 3], 5] as [Any]).map(\.ref),
                       [PRRef(repo: "SQUADD26/clotch", number: 4), PRRef(repo: "SQUADD26/clotch", number: 4), PRRef(repo: "o/r", number: 9)])
        XCTAssertEqual(PullRequests.parse(nil), [])
    }

    func testSessionFileCarriesPrs() throws {
        let json = #"{"sessionId": "local_a", "cliSessionId": "cli-a", "prs": [{"prNumber": 4, "repo": "o/r", "state": "OPEN"}], "remoteMcpServersConfig": {"x": 1}}"#
        let s = try XCTUnwrap(GoalSources.parseSession(Data(json.utf8), fileName: "local_a.json"))
        XCTAssertEqual(s.prs, [SessionPR(ref: PRRef(repo: "o/r", number: 4), state: "OPEN")])
    }

    private func session(_ id: String, parent: String? = nil, archived: Bool = false, prs: [SessionPR] = []) -> DesktopSession {
        DesktopSession(localId: id, cliId: "cli-" + id, parentLocalId: parent, title: id, isRunning: false,
                       isArchived: archived, lastActivity: nil, prs: prs)
    }
    private func pr(_ n: Int, _ state: String? = "OPEN", repo: String = "o/r") -> SessionPR { SessionPR(ref: PRRef(repo: repo, number: n), state: state) }

    func testByGoalGathersFamilyIncludingArchivedAndProofsDroppingClosed() {
        let sessions = [
            session("m", prs: [pr(1), pr(6, "CLOSED")]),
            session("c1", parent: "m", archived: true, prs: [pr(2, "MERGED"), pr(1, "MERGED")]),  // 1 merged here, stale OPEN in the master
            session("g1", parent: "c1", prs: [pr(3)]),   // grandchild under an archived child
            session("other", prs: [pr(99)]),
        ]
        let goal = GoalRecord(cli: "cli-m", goal: "g", state: "aperto", proof: "", at: nil, title: "",
                              proofs: [GoalProof(text: "PR #5 unita, vedi https://github.com/x/y/pull/8", done: true, at: nil)])
        XCTAssertEqual(PullRequests.byGoal(goals: [goal], sessions: sessions)["cli-m"],
                       [pr(1, "MERGED"), pr(2, "MERGED"), pr(3), pr(5, nil), pr(8, nil, repo: "x/y")], "6 is closed: gone; 1 takes the newer MERGED")
        let hidden = GoalRecord(cli: "cli-m", goal: "g", state: "passato", proof: "", at: nil, title: "", proofs: nil)
        XCTAssertNil(PullRequests.byGoal(goals: [hidden], sessions: sessions)["cli-m"])
    }

    // MARK: PRTracker: only open PRs stay; a merge is news once

    private func info(_ n: Int, _ state: PRState) -> PRInfo { PRInfo(ref: PRRef(repo: "o/r", number: n), title: "t\(n)", url: "u", state: state) }

    func testLaunchIsABaselineNoBurst() {
        let goals = ["g": [pr(1, "MERGED"), pr(2), pr(3), pr(4, "CLOSED")]]
        var t = PRTracker()
        XCTAssertEqual(t.toAsk(goals), [PRRef(repo: "o/r", number: 2), PRRef(repo: "o/r", number: 3)],
                       "the app's MERGED is not asked again at launch")
        // 3 merged while the app was off but the session file still says OPEN: GitHub says merged, still no event at launch.
        let out = t.settle(goals, answers: [PRRef(repo: "o/r", number: 2): info(2, .green), PRRef(repo: "o/r", number: 3): info(3, .merged)])
        XCTAssertEqual(out.merged, [])
        XCTAssertEqual(out.open["g"]?.map(\.ref.number), [2], "merged and closed are not shown")
        XCTAssertEqual(t.seen, [PRRef(repo: "o/r", number: 1), PRRef(repo: "o/r", number: 3)])
    }

    func testFreshMergeIsEmittedOnceThenDropped() {
        var goals = ["g": [pr(2), pr(3)]]
        var t = PRTracker(seen: [])
        _ = t.toAsk(goals)
        _ = t.settle(goals, answers: [PRRef(repo: "o/r", number: 2): info(2, .pending), PRRef(repo: "o/r", number: 3): info(3, .red)])  // baseline pass
        // 2 merges: the session file says MERGED and GitHub confirms.
        goals = ["g": [pr(2, "MERGED"), pr(3)]]
        XCTAssertEqual(t.toAsk(goals).map(\.number), [2, 3])
        var out = t.settle(goals, answers: [PRRef(repo: "o/r", number: 2): info(2, .merged), PRRef(repo: "o/r", number: 3): info(3, .red)])
        XCTAssertEqual(out.merged.map(\.ref.number), [2], "news the first time")
        XCTAssertEqual(out.open["g"]?.map(\.state), [.red])
        XCTAssertEqual(t.toAsk(goals).map(\.number), [3], "a seen merge is not asked again")
        out = t.settle(goals, answers: [PRRef(repo: "o/r", number: 3): info(3, .red)])
        XCTAssertEqual(out.merged, [], "never twice")
        // A restart remembers it from disk and, after its baseline, stays quiet.
        var t2 = PRTracker(seen: t.seen)
        _ = t2.toAsk(goals)
        XCTAssertEqual(t2.settle(goals, answers: [:]).merged, [])
        XCTAssertEqual(t2.toAsk(goals).map(\.number), [3])
    }

    func testOpenPrGoneMergedOnGitHubOnlyIsAlsoNews() {
        var t = PRTracker(seen: [])
        let open = ["g": [pr(7)]]
        _ = t.toAsk(open); _ = t.settle(open, answers: [PRRef(repo: "o/r", number: 7): info(7, .green)])
        let out = t.settle(open, answers: [PRRef(repo: "o/r", number: 7): info(7, .merged)])
        XCTAssertEqual(out.merged.map(\.ref.number), [7], "the session file did not catch up yet; GitHub did")
        XCTAssertNil(out.open["g"])
    }

    func testClosedUnmergedVanishesSilently() {
        var t = PRTracker(seen: [])
        let goals = ["g": [pr(9)]]
        _ = t.toAsk(goals); _ = t.settle(goals, answers: [PRRef(repo: "o/r", number: 9): info(9, .green)])
        let out = t.settle(goals, answers: [PRRef(repo: "o/r", number: 9): info(9, .closed)])
        XCTAssertEqual(out.merged, [])
        XCTAssertTrue(out.open.isEmpty)
        XCTAssertTrue(t.seen.isEmpty)
    }

    func testBareHashNeedsASingleRepo() {
        let two = [PRRef(repo: "a/b", number: 1), PRRef(repo: "c/d", number: 2)]
        XCTAssertEqual(PullRequests.refs(inProofs: ["fatto #7"], sessionRefs: two), [])
        XCTAssertEqual(PullRequests.refs(inProofs: ["fatto #7", "issue#8 e a#9"], sessionRefs: [two[0]]), [PRRef(repo: "a/b", number: 7)])
    }
}
