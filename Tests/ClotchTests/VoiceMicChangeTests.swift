import AVFoundation
import XCTest
@testable import Clotch

/// The microphone follows a device change (AirPods in or out) under an open capture: the engine is started again, once per change.
@MainActor
final class VoiceMicChangeTests: XCTestCase {
    private final class Counting: VoiceCapture, @unchecked Sendable {
        var runs = 0
        override func run() throws { runs += 1 }
    }

    func testEngineIsRestartedOnEveryDeviceChangeWhileOpen() throws {
        let c = Counting()
        try c.start()
        XCTAssertEqual(c.runs, 1)
        for n in 2...3 {
            NotificationCenter.default.post(name: .AVAudioEngineConfigurationChange, object: c.engine)
            let done = expectation(description: "restart \(n)")
            DispatchQueue.main.async { done.fulfill() }
            wait(for: [done], timeout: 1)
            XCTAssertEqual(c.runs, n, "restart after change \(n - 1)")
        }
        c.stop()
        NotificationCenter.default.post(name: .AVAudioEngineConfigurationChange, object: c.engine)
        XCTAssertEqual(c.runs, 3, "closed: a change restarts nothing")
    }
}
