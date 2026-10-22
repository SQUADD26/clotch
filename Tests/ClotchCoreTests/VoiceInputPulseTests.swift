import XCTest
@testable import ClotchCore

final class VoiceInputPulseTests: XCTestCase {
    private let frame = 1.0 / 120 // the fastest screen the notch runs on
    private let pulse = VoiceInputPulse(rise: 0.5, hold: 1, fall: 1) // Figma «durata/luce-rossa/…» (#168)

    private func maxStep(_ v: [Double]) -> Double { zip(v, v.dropFirst()).map { abs($1 - $0) }.max()! }

    func testNoJumpBetweenTwoFramesAt120Hz() {
        let v = stride(from: 0.0, through: 10, by: frame).map(pulse.level(at:))
        XCTAssertLessThan(maxStep(v), 0.03)
        let oldFlash: [Double] = stride(from: 0.0, through: 3, by: frame).map { (t: Double) -> Double in 0.4 + 0.6 * (sin(t * 6 * .pi) + 1) / 2 } // #145's red: 3 flashes a second
        XCTAssertGreaterThan(maxStep(oldFlash), 0.03) // control: this test would have failed it
    }

    func testVoiceOutLightHasNoJumpEither() throws {
        let steps = (0...120).map { $0 % 2 == 0 ? "0" : "1" }.joined(separator: ",") // worst voice: loud/silent every 50 ms
        let s = try XCTUnwrap(VoiceStatus.parse(Data(
            #"{"v":1,"parla":true,"t_inizio":10000,"t_fine":16000,"passo_ms":50,"livello":[\#(steps)]}"#.utf8)))
        let v: [Double] = stride(from: 10_000.0, to: 16_000, by: frame * 1000).map { Double(s.intensity(at: Date(timeIntervalSince1970: $0 / 1000))) }
        XCTAssertLessThan(maxStep(v), 0.03)
    }

    /// #168: one error, one pulse; the light goes off by itself and never comes back, however long the error stays (hours, before).
    func testOneErrorOnePulseThenDarkForGood() {
        XCTAssertEqual(pulse.level(at: 0), 0)
        XCTAssertEqual(pulse.level(at: pulse.rise), 1, accuracy: 1e-9)
        XCTAssertEqual(pulse.level(at: pulse.rise + pulse.hold / 2), 1)
        XCTAssertLessThanOrEqual(pulse.total, 3)
        let after = stride(from: pulse.total, through: 5 * 3600, by: 0.5).map(pulse.level(at:))
        XCTAssertEqual(after.max(), 0)
        let ts = Array(stride(from: 0.0, through: 60, by: frame))
        let v = ts.map(pulse.level(at:))
        let tops = (1..<(v.count - 1)).filter { v[$0] > v[$0 - 1] && v[$0] >= v[$0 + 1] }
        XCTAssertEqual(tops.count, 1) // one pulse, not a blink
    }
}
