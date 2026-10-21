import XCTest
@testable import ClotchCore

/// clotch#114: the engine's state of a session reaches the notch: parsing, colour per phase, timer, order.
final class SessionMotorTests: GoalTestCase {
    /// A state file as claude-config's stato_sessione.py writes it (contract of #1924).
    func motor(_ phase: String, why: String = "", since: Double = 12, cli: String = "m", localId: String = "", seen: Double = 1, what: String = "") -> SessionMotor {
        GoalSources.parseMotor(Data("""
        {"cli": "\(cli)", "local_id": "\(localId)", "stato": "\(phase)", "perche": "\(why)", "da": "\(local(since))",
         "visto": "\(local(seen))", "titolo": "", "domande": [], "cosa": "\(what)", "muove": "", "errori": 0}
        """.utf8), cli: cli)!
    }

    func row(_ m: SessionMotor?, stato: String = "aperto", ago: Double = 5) -> GoalRow {
        GoalBoard.rows(goals: [g("m", stato: stato)], sessions: [s("local_m", cli: "m", ago: ago)], live: [], motor: m.map { [$0] } ?? [], now: now)[0]
    }

    // MARK: parsing

    func testParsesEveryPhaseOfTheContract() {
        let all: [(String, SessionPhase)] = [("lavora", .lavora), ("aspetta_roberto", .aspettaRoberto), ("aspetta_altro", .aspettaAltro),
                                             ("ferma", .ferma), ("problema", .problema)]
        for (raw, phase) in all { XCTAssertEqual(motor(raw).phase, phase, raw) }
        XCTAssertEqual(SessionPhase.allCases.count, all.count, "a new phase needs a row here")
    }

    func testPhaseNamesIgnoreCaseSpacesAndDashes() {
        XCTAssertEqual(SessionPhase(contract: " Aspetta Roberto "), .aspettaRoberto)
        XCTAssertEqual(SessionPhase(contract: "ASPETTA-ALTRO"), .aspettaAltro)
        XCTAssertNil(SessionPhase(contract: "dorme"), "a name this build does not know is not a phase")
    }

    func testParseKeepsReasonAndTime() {
        let m = motor("problema", why: "  il   test\\nfallisce ", since: 30)
        XCTAssertEqual(m.why, "il test fallisce")
        XCTAssertEqual(m.since?.timeIntervalSince(minutesAgo(30)) ?? 99, 0, accuracy: 1)
        XCTAssertEqual(m.cli, "m")
    }

    func testParseReadsTheRestOfTheContract() {
        let m = motor("aspetta_altro", why: "Aspetta 2 cose in background", cli: "c1", localId: "local_x", seen: 3, what: "la CI; il deploy")
        XCTAssertEqual(m.what, "la CI; il deploy")
        XCTAssertEqual(m.localId, "local_x")
        XCTAssertEqual(m.seen?.timeIntervalSince(minutesAgo(3)) ?? 99, 0, accuracy: 1)
        XCTAssertEqual(GoalSources.parseMotor(Data(#"{"cli": "from-file", "stato": "ferma"}"#.utf8), cli: "name")?.cli, "from-file")
        XCTAssertEqual(GoalSources.parseMotor(Data(#"{"stato": "ferma"}"#.utf8), cli: "name")?.cli, "name", "no cli inside: the file name")
    }

    func testParseNeedsAKnownPhase() {
        XCTAssertNil(GoalSources.parseMotor(Data(#"{"perche": "x"}"#.utf8), cli: "m"))
        XCTAssertNil(GoalSources.parseMotor(Data(#"{"stato": "boh"}"#.utf8), cli: "m"))
        XCTAssertNil(GoalSources.parseMotor(Data("{".utf8), cli: "m"), "a file caught mid-write")
        let bare = GoalSources.parseMotor(Data(#"{"stato": "ferma"}"#.utf8), cli: "m")
        XCTAssertEqual(bare?.why, "")
        XCTAssertNil(bare?.since)
    }

    // MARK: colours and words per phase

    func testEachPhaseHasItsOwnColour() {
        XCTAssertEqual(SessionPhase.lavora.rgb, RGB(48, 209, 88), "green")
        XCTAssertEqual(SessionPhase.aspettaRoberto.rgb, RGB(255, 159, 10), "orange: needs Roberto")
        XCTAssertEqual(SessionPhase.aspettaAltro.rgb, RGB(199, 199, 204), "light neutral")
        XCTAssertEqual(SessionPhase.ferma.rgb, RGB(142, 142, 147), "grey")
        XCTAssertEqual(SessionPhase.problema.rgb, RGB(255, 69, 58), "red")
        XCTAssertEqual(Set(SessionPhase.allCases.map { "\($0.rgb)" }).count, 5, "no two phases share a colour")
    }

    func testOnlyWaitingForRobertoPulsesOnlyWorkingAnimates() {
        XCTAssertEqual(SessionPhase.allCases.filter(\.pulses), [.aspettaRoberto])
        XCTAssertEqual(SessionPhase.allCases.filter(\.animates), [.lavora])
    }

    func testLabelsAreStatesNotSentences() {
        XCTAssertEqual(SessionPhase.allCases.map(\.label), ["In lavorazione", "In attesa di te", "In attesa", "Ferma", "Problema"])
    }

    // MARK: on the board

    func testEngineStateDecidesThePhase() {
        XCTAssertEqual(row(motor("aspetta_roberto")).phase, .aspettaRoberto)
        XCTAssertEqual(row(motor("aspetta_altro", why: "la CI")).motor?.why, "la CI")
        XCTAssertEqual(row(motor("ferma"), ago: 5).phase, .ferma, "recent activity does not override the engine")
        XCTAssertEqual(row(motor("lavora"), ago: 180).phase, .lavora, "nor does silence")
    }

    func testWithoutEngineFileActivityDecides() {
        XCTAssertEqual(row(nil, ago: 5).phase, .lavora)
        XCTAssertEqual(row(nil, ago: 180).phase, .ferma)
        XCTAssertNil(row(nil).motor)
    }

    func testRegisterBlockedIsAProblemWhateverTheEngineSays() {
        XCTAssertEqual(row(motor("lavora"), stato: "bloccato").phase, .problema)
        XCTAssertEqual(row(motor("lavora"), stato: "raggiunto").phase, .ferma)
    }

    func testEngineFileIsFoundByTheMastersCurrentCliAfterAClear() {
        let goal = g("old")
        let master = s("local_m", cli: "new").withPrior(["old"])
        let r = GoalBoard.rows(goals: [goal], sessions: [master], live: [], motor: [motor("aspetta_roberto", cli: "new")], now: now)
        XCTAssertEqual(r[0].phase, .aspettaRoberto)
    }

    func testEngineFileIsFoundByTheClaudeAppIdAndTheNewestWins() {
        let master = s("local_m", cli: "new").withPrior(["older"])
        let old = motor("problema", cli: "older", localId: "local_m", seen: 90)
        let fresh = motor("aspetta_roberto", cli: "newer", localId: "local_m", seen: 2)
        let other = motor("lavora", cli: "x", localId: "local_other", seen: 1)
        let r = GoalBoard.rows(goals: [g("older")], sessions: [master], live: [], motor: [old, other, fresh], now: now)
        XCTAssertEqual(r[0].motor?.cli, "newer", "after a /clear two files name one session; the latest sign of life wins")
    }

    func testTimerCountsTimeInTheStateAndKeepsRunningWhileWaiting() {
        let r = row(motor("aspetta_roberto", since: 12), ago: 180)
        XCTAssertEqual(try XCTUnwrap(r.clockStart).timeIntervalSince(minutesAgo(12)), 0, accuracy: 1, "from entering the state, not from the goal's start")
        XCTAssertNil(r.workEnd, "a session waiting for Roberto counts how long he made it wait")
        XCTAssertNotEqual(r.clockStart, r.since)
    }

    func testWithoutEngineFileTheTimerKeepsItsOldRules() {
        let working = row(nil, ago: 5)
        XCTAssertEqual(working.clockStart, working.since)
        XCTAssertNil(working.workEnd)
        let still = row(nil, ago: 180)
        XCTAssertEqual(still.workEnd, minutesAgo(180))
    }

    func testRowsNeedingRobertoComeBeforeWorkingOnes() {
        let goals = [g("a"), g("b"), g("c"), g("d")]
        let sessions = [s("local_a", cli: "a"), s("local_b", cli: "b"), s("local_c", cli: "c"), s("local_d", cli: "d")]
        let motors = [motor("lavora", cli: "a"), motor("aspetta_roberto", cli: "b"), motor("problema", cli: "c"), motor("ferma", cli: "d")]
        let order = GoalBoard.rows(goals: goals, sessions: sessions, live: [], motor: motors, now: now).map(\.id)
        XCTAssertEqual(order, ["c", "b", "d", "a"], "problem, Roberto, still, working")
    }

    // MARK: on disk

    func testLoaderReadsTheStateFolder() throws {
        let fm = FileManager.default
        let home = fm.temporaryDirectory.appendingPathComponent("goals-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: home) }
        let paths = GoalSources.defaultPaths(home: home)
        try fm.createDirectory(at: paths.goals, withIntermediateDirectories: true)
        try fm.createDirectory(at: paths.states, withIntermediateDirectories: true)
        try goalJSON("m").write(to: paths.goals.appendingPathComponent("m.json"))
        let file = paths.states.appendingPathComponent("m.json")
        try Data(#"{"stato": "aspetta_roberto", "perche": "scegli A o B", "da": "2026-10-21T13:00:00+0000"}"#.utf8).write(to: file)
        let loader = GoalLoader(paths: paths)
        XCTAssertEqual(loader.load(changed: nil)?.motor.map(\.phase), [.aspettaRoberto])
        XCTAssertTrue(paths.states.path.hasSuffix(".claude/sessioni-stato"))

        try Data(#"{"stato": "lavora", "da": "2026-10-21T13:30:00+0000"}"#.utf8).write(to: file)
        try fm.setAttributes([.modificationDate: Date(timeIntervalSinceNow: 5)], ofItemAtPath: file.path)
        XCTAssertEqual(loader.load(changed: [file.path])?.motor.map(\.phase), [.lavora], "a rewrite of the state file ships a new board")
    }
}
