import AVFoundation
import XCTest
@testable import Clotch

/// The microphone follows a device change (AirPods in or out) under an open capture: the engine is started again, once per change.
/// A change that leaves the device and the format as they were (the engine's own, at its start) restarts the same engine (#314).
@MainActor
final class VoiceMicChangeTests: XCTestCase {
    private final class Counting: VoiceCapture, @unchecked Sendable {
        var runs = 0, restarts = 0
        var device = "a"
        override func run() throws { runs += 1 }
        override func setup() -> String { device }
        override func restart() { restarts += 1 }
    }

    private func change(_ c: Counting) {
        NotificationCenter.default.post(name: .AVAudioEngineConfigurationChange, object: c.engine)
        let done = expectation(description: "change")
        DispatchQueue.main.async { done.fulfill() }
        wait(for: [done], timeout: 1)
    }

    func testEngineIsRebuiltOnEveryDeviceChangeWhileOpen() throws {
        let c = Counting()
        try c.start()
        XCTAssertEqual(c.runs, 1)
        for n in 2...3 {
            c.device = "\(n)"
            change(c)
            XCTAssertEqual(c.runs, n, "rebuild after change \(n - 1)")
        }
        c.stop()
        NotificationCenter.default.post(name: .AVAudioEngineConfigurationChange, object: c.engine)
        XCTAssertEqual(c.runs, 3, "closed: a change restarts nothing")
    }

    /// #314: 30 rebuilds in 4 s, each one posting the next change, and no audio reached Scribe.
    func testOwnChangeRestartsTheSameEngine() throws {
        let c = Counting()
        try c.start()
        for _ in 1...5 { change(c) }
        XCTAssertEqual(c.runs, 1, "same device and format: no new engine")
        XCTAssertEqual(c.restarts, 5)
        c.stop()
    }
}
