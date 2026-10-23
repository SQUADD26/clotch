import XCTest
@testable import ClotchCore

final class ScreenNoticeTests: XCTestCase {
    private let t0 = Date(timeIntervalSince1970: 1_800_000_000)
    private func line(_ tipo: String, _ da: String, at: Double, tra: Int? = nil) -> String {
        "{\"tipo\":\"\(tipo)\",\"da\":\"\(da)\",\"t\":\(Int((t0.timeIntervalSince1970 + at) * 1000))" + (tra.map { ",\"tra_ms\":\($0)" } ?? "") + "}\n"
    }
    private func phase(_ lines: String..., at: Double) -> ScreenNotice.Phase? {
        ScreenNotice.phase(in: Data(lines.joined().utf8), now: t0.addingTimeInterval(at), freeHold: 1.2)
    }

    func testCountdownRunsForTraMs() {
        let e = line("schermo_in_arrivo", "apri-master", at: 0, tra: 1500)
        XCTAssertEqual(phase(e, at: 0.4), .incoming(deadline: t0.addingTimeInterval(1.5), total: 1.5))
        XCTAssertNil(phase(e, at: 1.6), "past the deadline the script works: the notch is quiet")
    }

    func testFreeIsHeldThenGone() {
        let e = line("schermo_in_arrivo", "a", at: 0, tra: 1500) + line("schermo_libero", "a", at: 3)
        XCTAssertEqual(phase(e, at: 3.5), .free(until: t0.addingTimeInterval(4.2)))
        XCTAssertNil(phase(e, at: 4.3))
    }

    func testSeveralScriptsMakeOneNotice() {
        let e = line("schermo_in_arrivo", "a", at: 0, tra: 1500) + line("schermo_in_arrivo", "b", at: 0.5, tra: 1500) + line("schermo_libero", "a", at: 2)
        XCTAssertEqual(phase(e, at: 1), .incoming(deadline: t0.addingTimeInterval(2), total: 1.5), "the countdown that ends last")
        XCTAssertNil(phase(e, at: 2.5), "b still works: no «Schermo libero» yet")
        XCTAssertEqual(phase(e, line("schermo_libero", "b", at: 3), at: 3.2), .free(until: t0.addingTimeInterval(4.2)))
    }

    func testDeadScriptDoesNotBlockForever() {
        let e = line("schermo_in_arrivo", "a", at: 0, tra: 1500) + line("schermo_libero", "b", at: 70)
        XCTAssertEqual(phase(e, at: 70.5), .free(until: t0.addingTimeInterval(71.2)))
    }

    func testOtherEventsAndBrokenLinesAreIgnored() {
        let e = "{\"tipo\":\"domanda\",\"t\":\(Int(t0.timeIntervalSince1970 * 1000))}\nnon json\n"
        XCTAssertNil(phase(e, at: 0.1))
    }

    func testTheVoiceNeverLogsThemAsUnknown() {
        let data = Data((line("schermo_in_arrivo", "a", at: 1, tra: 1500) + line("schermo_libero", "a", at: 2)).utf8)
        let read = VoiceEvents.newer(data, after: VoiceEvents.Mark(at: t0, id: ""))
        XCTAssertTrue(read.events.isEmpty)
        XCTAssertTrue(read.unknown.isEmpty)
    }
}
