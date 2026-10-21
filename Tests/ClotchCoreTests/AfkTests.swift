import XCTest
@testable import ClotchCore

final class AfkTests: XCTestCase {
    private var home: URL!
    private var clotch: URL!
    private var files: AfkFiles!

    override func setUpWithError() throws {
        home = FileManager.default.temporaryDirectory.appendingPathComponent("afk-\(UUID().uuidString)")
        clotch = home.appendingPathComponent("altrove")
        try FileManager.default.createDirectory(at: home.appendingPathComponent(".config/voce"), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: clotch, withIntermediateDirectories: true)
        files = AfkFiles(home: home, env: ["CLOTCH_DIR": clotch.path])
    }

    override func tearDown() { try? FileManager.default.removeItem(at: home) }

    private func put(_ text: String, _ url: URL) throws { try Data(text.utf8).write(to: url) }

    func testClotchDirMovesTheListOnly() {
        XCTAssertEqual(files.doneURL.path, clotch.appendingPathComponent("afk-fatto.jsonl").path)
        XCTAssertEqual(files.stateURL.path, home.appendingPathComponent(".config/voce/afk.json").path)
        XCTAssertEqual(AfkFiles(home: home, env: [:]).summaryURL.path, home.appendingPathComponent(".config/clotch/afk-riepilogo.json").path)
    }

    func testState() throws {
        XCTAssertFalse(files.isOn)  // no file = not away
        try put(#"{"v":1,"attivo":true,"inizio":1792603200,"fine":null}"#, files.stateURL)
        XCTAssertTrue(files.isOn)
        XCTAssertEqual(files.state, AfkState(attivo: true, inizio: 1792603200, fine: nil))
        try put(#"{"v":1,"attivo":false,"inizio":1792603200,"fine":1792609320.5}"#, files.stateURL)
        XCTAssertFalse(files.isOn)
        try put("rotto", files.stateURL)
        XCTAssertNil(files.state)
    }

    func testItemsSkipBrokenLinesAndOlderOnes() throws {
        try put("""
        {"v":1,"t":100,"tipo":"fine_turno","titolo":"Vecchio","testo":"prima di AFK"}
        non json
        {"v":1,"t":1792603200.5,"tipo":"richiesta_fatta","sessione":"⚙ Config: eventi voce","local_id":"local_1","titolo":"Eventi per la voce","testo":"Ho finito.","link":"","prova":"#1854"}
        {"v":1,"tipo":"senza ora"}
        {"v":1,"t":1792603300,"tipo":"pr_unita","titolo":"Eventi per la voce","testo":"Entrata la PR.","link":"https://github.com/SQUADD26/claude-config/pull/1854"}
        """, files.doneURL)
        let items = files.items(since: 1792603000)
        XCTAssertEqual(items.map(\.tipo), ["richiesta_fatta", "pr_unita"])
        XCTAssertEqual(items[0].localId, "local_1")
        XCTAssertEqual(items[1].sessione, "")  // missing = empty
        XCTAssertEqual(items[1].linkLabel, "PR #1854")
        XCTAssertNil(items[0].linkLabel)
        XCTAssertEqual(items.map(\.kind), ["Richiesta fatta", "PR unita"])
    }

    func testGroupsByWorkMostRecentFirstEachInTimeOrder() {
        let items = [
            AfkItem(t: 3, tipo: "pr_unita", titolo: "Avviso", testo: "PR", link: "https://github.com/o/r/pull/105"),
            AfkItem(t: 1, tipo: "obiettivo_bloccato", sessione: "⌕ Ricerca: voci ElevenLabs", localId: "local_r", titolo: "Voci", testo: "Manca la chiave."),
            AfkItem(t: 2, tipo: "fine_turno", sessione: "⌘ Clotch: avviso di aggiornamento", localId: "local_c", titolo: "Avviso", testo: "Pronto."),
        ]
        let groups = AfkGroup.groups(items)
        XCTAssertEqual(groups.map(\.title), ["Avviso", "Voci"])
        XCTAssertEqual(groups[0].items.map(\.t), [2, 3])
        XCTAssertEqual(groups[0].session, "⌘ Clotch: avviso di aggiornamento")  // the PR line has none: the other's
        XCTAssertEqual(groups[0].localId, "local_c")
        XCTAssertEqual(groups[0].chip?.icon, "⌘")
        XCTAssertEqual(groups[0].chip?.area, "Clotch")
        XCTAssertEqual(groups[0].subtitle, "Clotch: avviso di aggiornamento · 2 cose")
        XCTAssertEqual(groups[1].subtitle, "Ricerca: voci ElevenLabs · 1 cosa")
        let alone = AfkGroup.groups([AfkItem(t: 1, tipo: "pr_unita", titolo: "Solo PR", testo: "x")])[0]
        XCTAssertNil(alone.chip)
        XCTAssertEqual(alone.subtitle, "1 cosa")
    }

    func testReportReadsSummaryAndItsList() throws {
        try put(#"{"v":1,"t":1792609320,"inizio":1792603200,"n":2,"frase":"Sono entrate 2 PR.","gruppi":[{"titolo":"Avviso","n":2}]}"#, files.summaryURL)
        try put("""
        {"v":1,"t":1792603100,"tipo":"fine_turno","titolo":"Prima","testo":"no"}
        {"v":1,"t":1792604000,"tipo":"fine_turno","titolo":"Avviso","testo":"sì"}
        {"v":1,"t":1792605000,"tipo":"pr_unita","titolo":"Avviso","testo":"sì"}
        """, files.doneURL)
        let report = try XCTUnwrap(files.report)
        XCTAssertEqual(report.count, 2)
        XCTAssertEqual(report.sentence, "Sono entrate 2 PR.")
        XCTAssertEqual(report.heading, "2 cose · via per 1 h 42 min")
        XCTAssertEqual(report.groups.map(\.title), ["Avviso"])
    }

    func testNothingDone() {
        let report = AfkReport(summary: AfkSummary(t: 1500, inizio: 0, n: 0, frase: ""), items: [])
        XCTAssertEqual(report.sentence, "Mentre eri via non è successo niente di importante.")
        XCTAssertEqual(report.heading, "via per 25 min")
        XCTAssertTrue(report.groups.isEmpty)
    }

    func testSummaryShownOnceAndOnlyFresh() {
        let s = AfkSummary(t: 1000, inizio: 0, n: 0, frase: "")
        XCTAssertTrue(s.isNew(seen: 0, now: Date(timeIntervalSince1970: 1060)))
        XCTAssertFalse(s.isNew(seen: 1000, now: Date(timeIntervalSince1970: 1060)))  // already shown
        XCTAssertFalse(s.isNew(seen: 0, now: Date(timeIntervalSince1970: 1000 + 3601)))  // over an hour
    }

    func testDuration() {
        XCTAssertEqual(AfkReport.duration(10), "1 min")
        XCTAssertEqual(AfkReport.duration(7200), "2 h")
        XCTAssertEqual(AfkReport.duration(6 * 3600 + 34 * 60), "6 h 34 min")
    }

    func testBackOnlyAfterBeingAway() {
        var p = AfkPresence()
        XCTAssertFalse(p.back(idle: 1))  // just switched on, still at the Mac
        XCTAssertFalse(p.back(idle: 200))
        XCTAssertTrue(p.back(idle: 0.5))
        XCTAssertFalse(p.back(idle: 0.5))  // once
    }
}
