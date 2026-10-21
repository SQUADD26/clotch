import XCTest
@testable import CodeIslandCore

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
        let q = PullRequests.query([PRRef(repo: "SQUADD26/goal-notch", number: 4), PRRef(repo: "a\" b/c", number: 5), PRRef(repo: "o/r", number: 7)])
        XCTAssertTrue(q.contains("p0: repository(owner: \"SQUADD26\", name: \"goal-notch\") { pullRequest(number: 4)"))
        XCTAssertFalse(q.contains("p1:"), "a name with a quote never reaches the query")
        XCTAssertTrue(q.contains("p2: repository(owner: \"o\", name: \"r\") { pullRequest(number: 7)"))
    }

    func testSessionPrsFieldShapes() {
        let url = "https://github.com/SQUADD26/goal-notch/pull/4"
        XCTAssertEqual(PullRequests.parse([url, ["url": "\(url)/files"], ["number": 9, "repo": "o/r"], ["number": 3], 5, ["repository": "o/r", "number": 2]] as [Any]),
                       [PRRef(repo: "SQUADD26/goal-notch", number: 4), PRRef(repo: "SQUADD26/goal-notch", number: 4),
                        PRRef(repo: "o/r", number: 9), PRRef(repo: "o/r", number: 2)])
        XCTAssertEqual(PullRequests.parse(nil), [])
    }

    func testSessionFileCarriesPrs() throws {
        let json = #"{"sessionId": "local_a", "cliSessionId": "cli-a", "prs": [{"number": 4, "repo": "o/r"}], "remoteMcpServersConfig": {"x": 1}}"#
        let s = try XCTUnwrap(GoalSources.parseSession(Data(json.utf8), fileName: "local_a.json"))
        XCTAssertEqual(s.prs, [PRRef(repo: "o/r", number: 4)])
    }

    func testByGoalGathersFamilyIncludingArchivedAndProofs() {
        func session(_ id: String, parent: String? = nil, archived: Bool = false, prs: [PRRef] = []) -> DesktopSession {
            DesktopSession(localId: id, cliId: "cli-" + id, parentLocalId: parent, title: id, isRunning: false,
                           isArchived: archived, lastActivity: nil, prs: prs)
        }
        let sessions = [
            session("m", prs: [PRRef(repo: "o/r", number: 1)]),
            session("c1", parent: "m", archived: true, prs: [PRRef(repo: "o/r", number: 2)]),
            session("g1", parent: "c1", prs: [PRRef(repo: "o/r", number: 3)]),   // grandchild under an archived child
            session("other", prs: [PRRef(repo: "o/r", number: 99)]),
        ]
        let goal = GoalRecord(cli: "cli-m", goal: "g", state: "aperto", proof: "", at: nil, title: "",
                              proofs: [GoalProof(text: "PR #5 unita, vedi https://github.com/x/y/pull/8", done: true, at: nil)])
        XCTAssertEqual(PullRequests.byGoal(goals: [goal], sessions: sessions)["cli-m"],
                       [PRRef(repo: "o/r", number: 1), PRRef(repo: "o/r", number: 2), PRRef(repo: "o/r", number: 3),
                        PRRef(repo: "o/r", number: 5), PRRef(repo: "x/y", number: 8)])
        let hidden = GoalRecord(cli: "cli-m", goal: "g", state: "passato", proof: "", at: nil, title: "", proofs: nil)
        XCTAssertNil(PullRequests.byGoal(goals: [hidden], sessions: sessions)["cli-m"])
    }

    func testBareHashNeedsASingleRepo() {
        let two = [PRRef(repo: "a/b", number: 1), PRRef(repo: "c/d", number: 2)]
        XCTAssertEqual(PullRequests.refs(inProofs: ["fatto #7"], sessionRefs: two), [])
        XCTAssertEqual(PullRequests.refs(inProofs: ["fatto #7", "issue#8 e a#9"], sessionRefs: [two[0]]), [PRRef(repo: "a/b", number: 7)])
    }
}
