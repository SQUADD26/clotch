import XCTest
@testable import ClotchCore

/// #184: `battito-passi.json` was written by the engine's own `overseer_ciclo.passo` (claude-config PR 2052):
/// avvisi_voce failed 3 beats in a row, afk ok, osservatore failed once.
final class HeartbeatStepsTests: XCTestCase {
    private func engineFile() throws -> [String: HeartbeatSteps.Step] {
        let dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
        return try XCTUnwrap(HeartbeatSteps.parse(Data(contentsOf: dir.appendingPathComponent("Fixtures/battito-passi.json"))))
    }

    func testEngineFileIsRead() throws {
        let steps = try engineFile()
        XCTAssertEqual(steps["avvisi_voce"], .init(ok: 0, failed: 3, error: "ValueError: riga guasta in avvisi.json"))
        XCTAssertEqual(steps["afk"]?.failed, 0)
        XCTAssertGreaterThan(steps["afk"]?.ok ?? 0, 0)
        XCTAssertEqual(steps["osservatore"]?.failed, 1)
    }

    func testOnlyAStepFailedThreeBeatsIsSaidOnce() throws {
        let steps = try engineFile()
        let first = HeartbeatSteps.stuck(old: [:], new: steps)
        XCTAssertEqual(first.map(\.subject), ["avvisi_voce"], "afk ok and osservatore at 1 say nothing")
        XCTAssertEqual(first.first?.kind, .stepStuck)
        XCTAssertEqual(first.first?.text, "Friday: «avvisi voce» non riesce da 3 giri")
        var worse = steps
        worse["avvisi_voce"] = .init(ok: 0, failed: 4, error: "x")
        XCTAssertEqual(HeartbeatSteps.stuck(old: steps, new: worse), [], "still stuck: no second notice")
    }

    func testANewStreakAfterARecoveryIsANewEvent() {
        let a = HeartbeatSteps.stuck(old: [:], new: ["afk": .init(ok: 100, failed: 3, error: "")])
        let recovered: [String: HeartbeatSteps.Step] = ["afk": .init(ok: 200, failed: 0, error: "")]
        let b = HeartbeatSteps.stuck(old: recovered, new: ["afk": .init(ok: 200, failed: 3, error: "")])
        XCTAssertEqual(b.count, 1)
        XCTAssertNotEqual(a.first?.id, b.first?.id, "the notifier's «seen» must not swallow the second streak")
    }

    func testNotTheEngineShapeIsNothing() {
        XCTAssertNil(HeartbeatSteps.parse(Data("[]".utf8)))
        XCTAssertNil(HeartbeatSteps.parse(Data("rotto".utf8)))
    }
}
