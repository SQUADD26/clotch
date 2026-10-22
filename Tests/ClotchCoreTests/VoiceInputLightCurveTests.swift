import XCTest
@testable import ClotchCore

final class VoiceInputLightCurveTests: XCTestCase {
    private let frame = 1.0 / 120 // the fastest screen the notch runs on

    private func maxStep(_ v: [Double]) -> Double { zip(v, v.dropFirst()).map { abs($1 - $0) }.max()! }

    func testNoJumpBetweenTwoFramesAt120Hz() {
        let v = stride(from: 0.0, through: 30, by: frame).map(VoiceInputLightCurve.red(at:))
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

    func testRisesSlowlyThenStaysHigh() {
        XCTAssertEqual(VoiceInputLightCurve.red(at: 0), 0)
        XCTAssertGreaterThan(VoiceInputLightCurve.red(at: 0.3), 0.7) // ease-out: most of it early…
        XCTAssertLessThan(VoiceInputLightCurve.red(at: 0.05), 0.4)   // …but not at once
        XCTAssertEqual(VoiceInputLightCurve.red(at: VoiceInputLightCurve.rise), 1, accuracy: 1e-9)
        let hold = stride(from: 0.6, through: 30, by: frame).map(VoiceInputLightCurve.red(at:))
        XCTAssertGreaterThanOrEqual(hold.min()!, 1 - VoiceInputLightCurve.depth - 1e-9) // small breath
    }

    func testBreathPeriodIsAtLeastTwoSeconds() {
        let ts = Array(stride(from: 0.6, through: 30, by: frame))
        let v = ts.map(VoiceInputLightCurve.red(at:))
        var tops: [Double] = []
        for i in 1..<(v.count - 1) where v[i] > v[i - 1] && v[i] >= v[i + 1] { tops.append(ts[i]) }
        XCTAssertGreaterThanOrEqual(tops.count, 8) // control: it does breathe
        let gaps: [Double] = zip(tops, tops.dropFirst()).map { $1 - $0 }
        XCTAssertGreaterThanOrEqual(gaps.min()!, 2)
    }
}
