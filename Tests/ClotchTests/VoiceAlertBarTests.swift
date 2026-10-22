import XCTest
import ClotchCore
@testable import Clotch

/// #235, #236: «Dai l’ok» runs dai-ok and shows its outcome; what waits on Roberto is kept for the open notch.
@MainActor
final class VoiceAlertBarTests: XCTestCase {
    private let ok = { (id: String, at: Date) -> VoiceEvent in
        var e = VoiceEvent(kind: .waitsForOk, at: at, subject: "Setup", text: "Setup aspetta un tuo ok per X: vuoi che glielo dia io?", proof: "local_\(id)")
        e.id = "e-\(id)"
        return e
    }

    private var original = VoiceAlertBar.run
    override func tearDown() { VoiceAlertBar.run = original }

    func testReasonIsDaiOksLastLine() {
        XCTAssertNil(VoiceAlertBar.reason(code: 0, stdout: "tutto ok"))
        XCTAssertEqual(VoiceAlertBar.reason(code: 2, stdout: "riga\ndai-ok: «Setup» non trovata fra le sessioni aperte dell'app\n"),
                       "«Setup» non trovata fra le sessioni aperte dell'app")
        XCTAssertEqual(VoiceAlertBar.reason(code: 1, stdout: ""), "dai-ok è uscito con errore 1.")
    }

    func testWaitingKeepsOnePerSessionAndForgetsOldOnes() {
        let bar = VoiceAlertBar()
        let now = Date()
        bar.remember([ok("a", now.addingTimeInterval(-3 * 3600)), ok("b", now), VoiceEvent(kind: .requestDone, at: now)], now: now)
        XCTAssertEqual(bar.waiting.map(\.id), ["e-b"], "older than 2 h and other kinds stay out")
        bar.remember([ok("b", now)], now: now)
        XCTAssertEqual(bar.waiting.count, 1, "the same session once")
    }

    func testGiveOkRunsDaiOkWithTheEventAndSession() async throws {
        let bar = VoiceAlertBar()
        let e = ok("c", Date())
        bar.remember([e])
        let seen = LockedArgs()
        VoiceAlertBar.run = { args in seen.set(args); return (0, "") }
        bar.giveOk(e)
        XCTAssertEqual(bar.state, .sending)
        for _ in 0..<50 where bar.state == .sending { try await Task.sleep(nanoseconds: 20_000_000) }
        XCTAssertEqual(bar.state, .done)
        XCTAssertTrue(bar.waiting.isEmpty, "given: out of the open notch")
        XCTAssertEqual(Array(seen.get().dropFirst()), ["--evento", "e-c", "local_c"])
        XCTAssertTrue(seen.get().first?.hasSuffix("/.claude/hooks/dai_ok.py") == true)
    }

    func testFailedOkStaysWithItsReason() async throws {
        let bar = VoiceAlertBar()
        let e = ok("d", Date())
        VoiceAlertBar.run = { _ in (1, "dai-ok: «x» NON inviato a «Setup»: manca il permesso\n") }
        bar.giveOk(e)
        for _ in 0..<50 where bar.state == .sending { try await Task.sleep(nanoseconds: 20_000_000) }
        XCTAssertEqual(bar.state, .failed("«x» NON inviato a «Setup»: manca il permesso"))
        XCTAssertEqual(bar.current, e)
    }
}

private final class LockedArgs: @unchecked Sendable {
    private var args: [String] = []
    private let lock = NSLock()
    func set(_ a: [String]) { lock.lock(); args = a; lock.unlock() }
    func get() -> [String] { lock.lock(); defer { lock.unlock() }; return args }
}
