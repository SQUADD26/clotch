import XCTest
@testable import ClotchCore

/// #49: the goal timer runs while the master works and stops only when work really stopped.
final class GoalWorkTimerTests: GoalTestCase {
    /// A register file as obiettivo_vivo.py writes it: `ultima_attivita` at each prompt and Stop.
    func record(stato: String, seenAgo seconds: Double) -> GoalRecord {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
        return GoalSources.parseGoal(Data("""
        {"cli": "m", "obiettivo": "Timer che scorre", "da": "master", "stato": "\(stato)", "prova": "",
         "t": "2026-10-21T11:00:00+0000", "ultima_attivita": "\(f.string(from: now.addingTimeInterval(-seconds)))"}
        """.utf8))!
    }

    /// The master as the desktop app writes it after a /clear: no `isRunning`, `lastActivityAt` 3 h old.
    var master: DesktopSession {
        GoalSources.parseSession(Data("""
        {"sessionId": "local_m", "cliSessionId": "m", "title": "Clotch", "isArchived": false, "lastActivityAt": \(ms(180))}
        """.utf8), fileName: "local_m.json")!
    }

    func row(stato: String, seenAgo seconds: Double) -> GoalRow {
        GoalBoard.rows(goals: [record(stato: stato, seenAgo: seconds)], sessions: [master], live: [], now: now)[0]
    }

    func testOpenGoalSeenTenSecondsAgoRunsWithNoSessionMarkedRunning() {
        let r = row(stato: "aperto", seenAgo: 10)
        XCTAssertEqual(r.runningPulses, 0, "the app left isRunning out: the case that froze the timer")
        XCTAssertEqual(r.status, .moving)
        XCTAssertNil(r.workEnd, "at work: the clock runs")
    }

    func testOpenGoalSeenTwoHoursAgoStopsWhenItWentStill() {
        let r = row(stato: "aperto", seenAgo: 7200)
        XCTAssertEqual(r.workEnd, now.addingTimeInterval(-7200))
        XCTAssertEqual(r.status, .still(since: now.addingTimeInterval(-7200)))
    }

    func testReachedGoalStopsAtItsLastSignOfWork() {
        XCTAssertEqual(row(stato: "raggiunto", seenAgo: 10).workEnd, now.addingTimeInterval(-10))
        XCTAssertEqual(row(stato: "bloccato", seenAgo: 60).workEnd, now.addingTimeInterval(-60))
    }
}

private extension GoalRow {
    var runningPulses: Int { pulses.filter(\.running).count }
}
