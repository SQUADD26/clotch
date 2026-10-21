import XCTest
@testable import ClotchCore

/// #83: the other apps go down 0.5 s before the voice, stay down 0.5 s after it, come back, and are always given back.
final class VoiceDuckTests: XCTestCase {
    /// A virtual clock: `sleep` moves it, the backend and the voice write what happened when.
    private final class Clock {
        var now: TimeInterval = 0
        var log: [(TimeInterval, String)] = []
        func note(_ s: String) { log.append((now, s)) }
        func sleep(_ t: TimeInterval) async { now += t }
        var names: [String] { log.map(\.1) }
    }

    private final class Fake: DuckBackend {
        let clock: Clock
        let canBegin: Bool
        init(_ clock: Clock, canBegin: Bool = true) { self.clock = clock; self.canBegin = canBegin }
        func begin() -> Bool { clock.note("begin"); return canBegin }
        func fade(to gain: Double, over seconds: TimeInterval) { clock.note("fade \(gain) over \(seconds)") }
        func end() { clock.note("end") }
    }

    /// The real voice: its own 0.5 s lead, then 2 s of speech.
    private func voice(_ c: Clock, result: String? = nil) -> () async -> String? {
        {
            c.note("voice-wait")
            await c.sleep(VoiceStatus.lead)
            c.note("voice-start")
            await c.sleep(2)
            c.note("voice-end")
            return result
        }
    }

    func testFallsHalfASecondBeforeTheVoiceAndRisesHalfASecondAfter() async {
        let c = Clock()
        _ = await VoiceDuck.around(Fake(c), level: 0.2, sleep: c.sleep, voice: voice(c))
        XCTAssertEqual(c.names, ["begin", "fade 0.2 over 0.5", "voice-wait", "voice-start", "voice-end", "fade 1.0 over 0.5", "end"])
        func at(_ name: String) -> TimeInterval { c.log.first { $0.1 == name }!.0 }
        XCTAssertEqual(at("voice-start") - at("fade 0.2 over 0.5"), 0.5, "the fall starts 0.5 s before the first word")
        XCTAssertEqual(at("fade 1.0 over 0.5") - at("voice-end"), 0.5, "the rise starts 0.5 s after the last word")
        XCTAssertEqual(c.log.last!.0 - at("voice-end"), 1.0, "given back when the rise is done")
    }

    func testGivenBackWhenTheVoiceFails() async {
        let c = Clock()
        let failing: () async -> String? = { c.note("voice-fail"); return "ElevenLabs non risponde." }
        let said = await VoiceDuck.around(Fake(c), level: 0.2, sleep: c.sleep, voice: failing)
        XCTAssertEqual(said, "ElevenLabs non risponde.", "the voice's own result goes through")
        XCTAssertEqual(c.names.last, "end")
        XCTAssertTrue(c.names.contains("fade 1.0 over 0.5"))
    }

    func testGivenBackWhenTheTaskIsCancelled() async {
        let c = Clock()
        let task = Task { await VoiceDuck.around(Fake(c), level: 0.2, sleep: { _ in await Task.yield() }, voice: { await Task.yield(); return nil }) }
        task.cancel()
        _ = await task.value
        XCTAssertEqual(c.names.last, "end")
    }

    func testNoLoweringWhenTheBackendCannotStart() async {
        let c = Clock()
        _ = await VoiceDuck.around(Fake(c, canBegin: false), level: 0.2, sleep: c.sleep, voice: voice(c))
        XCTAssertEqual(c.names, ["begin", "voice-wait", "voice-start", "voice-end"], "the voice speaks, nothing fades, nothing to end")
    }

    func testSwitchOffMeansNoBackend() async {
        let c = Clock()
        _ = await VoiceDuck.around(nil, level: 0.2, sleep: c.sleep, voice: voice(c))
        XCTAssertEqual(c.names, ["voice-wait", "voice-start", "voice-end"])
    }

    func testConfigReadsSwitchAndLevel() {
        XCTAssertFalse(VoiceTurn.Config([:]).duck, "off until Roberto turns it on: the first use asks macOS for a permission")
        XCTAssertEqual(VoiceTurn.Config([:]).duckLevel, 0.2, accuracy: 1e-9)
        let on = VoiceTurn.Config(["abbassa_audio": true, "abbassa_livello": 35])
        XCTAssertTrue(on.duck)
        XCTAssertEqual(on.duckLevel, 0.35, accuracy: 1e-9)
        XCTAssertEqual(VoiceTurn.Config(["abbassa_livello": 250]).duckLevel, 0.8, accuracy: 1e-9, "never above the top of the slider")
        XCTAssertEqual(VoiceTurn.Config(["abbassa_livello": -5]).duckLevel, 0, accuracy: 1e-9)
    }
}
