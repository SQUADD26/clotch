import XCTest
@testable import ClotchCore

final class NotchVoiceTests: XCTestCase {
    private func json(_ extra: String = "", parla: Bool = true, t0: Int = 10_000, t1: Int = 12_000) -> Data {
        Data(#"{"v":1,"id":"a","parla":\#(parla),"t_inizio":\#(t0),"t_fine":\#(t1),"passo_ms":500\#(extra)}"#.utf8)
    }
    private func at(_ ms: Double) -> Date { Date(timeIntervalSince1970: ms / 1000) }

    func testParseValid() {
        let s = VoiceStatus.parse(json(#","livello":[0,0.5,1.5,-1]"#))
        XCTAssertEqual(s?.levels, [0, 0.5, 1, 0])
        XCTAssertEqual(s?.step, 0.5)
    }

    func testParseRejectsNotSpeakingWrongVersionAndBadRange() {
        XCTAssertNil(VoiceStatus.parse(json(parla: false)))
        XCTAssertNil(VoiceStatus.parse(json(t0: 5, t1: 5)))
        XCTAssertNil(VoiceStatus.parse(Data(#"{"v":2,"parla":true,"t_inizio":1,"t_fine":2}"#.utf8)))
        XCTAssertNil(VoiceStatus.parse(Data("not json".utf8)))
    }

    func testLightIsOnBeforeFirstWordAndExpires() throws {
        let s = try XCTUnwrap(VoiceStatus.parse(json()))
        XCTAssertTrue(s.isSpeaking(at: at(9_500)))   // 0.5 s before the first word
        XCTAssertTrue(s.isSpeaking(at: at(11_999)))
        XCTAssertFalse(s.isSpeaking(at: at(12_000))) // dead player: the file expires by itself
    }

    func testLevelFollowsSamplesAndInterpolates() throws {
        let s = try XCTUnwrap(VoiceStatus.parse(json(#","livello":[0,1,0.5]"#)))
        XCTAssertEqual(s.level(at: at(9_500)), VoiceStatus.steadyLevel)
        XCTAssertEqual(s.level(at: at(10_000)), VoiceStatus.steadyLevel) // position 0 has no earlier sample
        XCTAssertEqual(s.level(at: at(10_250)), 0.5, accuracy: 0.001)
        XCTAssertEqual(s.level(at: at(10_500)), 1, accuracy: 0.001)
        XCTAssertEqual(s.level(at: at(10_750)), 0.75, accuracy: 0.001)
        XCTAssertEqual(s.level(at: at(11_900)), 0.5)                      // past the last sample: holds it
    }

    func testNoSamplesIsSteady() throws {
        let s = try XCTUnwrap(VoiceStatus.parse(json()))
        XCTAssertEqual(s.level(at: at(11_000)), VoiceStatus.steadyLevel)
    }

    // #29: a voice that swings 0.3…1.0 once a second (Roberto's test) must not make the light beat.
    func testWavyVoiceGivesSteadyHighLight() throws {
        let wave = (0...120).map { 0.65 + 0.35 * sin(2 * Double.pi * Double($0) * 0.05) } // 6 s, one value per 50 ms
        let list = wave.map { String($0) }.joined(separator: ",")
        let s = try XCTUnwrap(VoiceStatus.parse(Data(
            #"{"v":1,"parla":true,"t_inizio":10000,"t_fine":16000,"passo_ms":50,"livello":[\#(list)]}"#.utf8)))
        let raw = stride(from: 11_000.0, to: 16_000, by: 10).map { s.level(at: at($0)) }
        XCTAssertGreaterThan(raw.max()! - raw.min()!, 0.6) // control: the input does swing
        let light = stride(from: 11_000.0, to: 16_000, by: 10).map { s.intensity(at: at($0)) }
        let lo = light.min()!, hi = light.max()!
        XCTAssertGreaterThanOrEqual(lo, VoiceStatus.minIntensity)
        XCTAssertLessThan((hi - lo) / hi, 0.1)
    }

    func testIntensityRisesSlowlyAndStaysInBand() throws {
        let steps = (0...120).map { $0 < 60 ? "0" : "1" }.joined(separator: ",") // silent 3 s, then loud
        let s = try XCTUnwrap(VoiceStatus.parse(Data(
            #"{"v":1,"parla":true,"t_inizio":10000,"t_fine":16000,"passo_ms":50,"livello":[\#(steps)]}"#.utf8)))
        XCTAssertEqual(s.intensity(at: at(11_500)), VoiceStatus.minIntensity, accuracy: 0.001)
        let mid = s.intensity(at: at(13_000))
        XCTAssertGreaterThan(mid, VoiceStatus.minIntensity + 0.05) // the swell starts on time…
        XCTAssertLessThan(mid, 0.95)                       // …but not as a jump
        XCTAssertEqual(s.intensity(at: at(14_500)), 1, accuracy: 0.001)
    }
}
