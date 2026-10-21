import XCTest
@testable import CodeIslandCore

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
}
