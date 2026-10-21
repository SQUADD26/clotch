import XCTest
@testable import ClotchCore

/// The dashboard's real shape (keys and types as GET /dashboard/data returns them).
final class AccountQuotaTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_792_590_000)

    func testWindowRulesAsMacchine() {
        let past = now.addingTimeInterval(-1), future = now.addingTimeInterval(3600)
        XCTAssertEqual(QuotaWindow(used: 130, reset: future).usedNow(now), 100)
        XCTAssertNil(QuotaWindow(used: 40, reset: past).usedNow(now), "reset passed: no percentage")
        XCTAssertEqual(QuotaWindow(used: 40, reset: past).leftNow(now), 100, "reset passed: whole again")
        XCTAssertEqual(QuotaWindow(used: 40, reset: nil).leftNow(now), 60)
        XCTAssertNil(QuotaWindow(used: nil, reset: future).leftNow(now))
    }

    func testMergeOrderAndLabel() throws {
        let json = """
        {"rows": [
          {"email": "fresco@squaddcrm.com", "host": "h", "user": "u", "five_used": 10, "five_resets": \(Int(now.timeIntervalSince1970) + 3600),
           "seven_used": 20, "seven_resets": \(Int(now.timeIntervalSince1970) + 86400), "five_ts": 1, "seven_ts": 1, "ts": \(Int(now.timeIntervalSince1970) - 60), "tokens": null},
          {"email": "vecchio@squaddcrm.com", "host": "h", "user": "u", "five_used": 0, "five_resets": null,
           "seven_used": 73, "seven_resets": 1792123200, "five_ts": 1, "seven_ts": 1, "ts": 1791800140, "tokens": null},
          {"email": "reale@gmail.com", "host": "h", "user": "u", "five_used": 99, "five_resets": null,
           "seven_used": 99, "seven_resets": null, "ts": \(Int(now.timeIntervalSince1970) - 30), "tokens": null}
        ],
        "real": [
          {"email": "reale@gmail.com", "five_used": 22, "five_resets": \(Int(now.timeIntervalSince1970) + 600),
           "seven_used": 70, "seven_resets": \(Int(now.timeIntervalSince1970) + 7200), "ts": \(Int(now.timeIntervalSince1970) - 120), "tokens": {}}
        ],
        "unk": [], "tkts": {}, "cur": null, "soglie": {}}
        """
        let list = try XCTUnwrap(AccountQuotas.parse(Data(json.utf8), now: now))
        XCTAssertEqual(list.map(\.label), ["fresco", "reale", "vecchio"], "most left first, stale last")
        let reale = try XCTUnwrap(list.first { $0.label == "reale" })
        XCTAssertEqual(reale.fiveHour.used, 22, "a direct reading under 10 min wins over a newer host row")
        XCTAssertTrue(list.last!.stale(now))
        XCTAssertNil(AccountQuotas.parse(Data("{}".utf8), now: now))
    }

    func testOldDirectReadingYieldsToNewerRow() {
        let t = now.timeIntervalSince1970
        let real = AccountQuota(email: "a@x", at: Date(timeIntervalSince1970: t - 900),
                                fiveHour: QuotaWindow(used: 1, reset: nil), sevenDay: QuotaWindow(used: 1, reset: nil))
        let row = AccountQuota(email: "a@x", at: Date(timeIntervalSince1970: t - 60),
                               fiveHour: QuotaWindow(used: 50, reset: nil), sevenDay: QuotaWindow(used: 1, reset: nil))
        XCTAssertEqual(AccountQuotas.merge(real: [real], rows: [row], now: now).first?.fiveHour.used, 50)
    }

    /// Bundle names as they run on Roberto's Mac (ps, 2026-10-21).
    func testAccountInUseFromAppBundleName() {
        XCTAssertEqual(AccountsInUse.email(bundleName: "Claude amministrazione＠squaddcrm.com.app"), "amministrazione@squaddcrm.com")
        XCTAssertEqual(AccountsInUse.email(bundleName: "Claude claudesquadd1＠gmail.com.app"), "claudesquadd1@gmail.com")
        XCTAssertEqual(AccountsInUse.email(bundleName: "Claude supporto@squaddcrm.com.app"), "supporto@squaddcrm.com")
        XCTAssertNil(AccountsInUse.email(bundleName: "Claude.app"), "the plain app names no account")
        XCTAssertNil(AccountsInUse.email(bundleName: "Claude Helper.app"))
        XCTAssertNil(AccountsInUse.email(bundleName: "Claude a＠b.com"), "not an app bundle")
    }
}

final class ResetCountdownTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_792_590_000)
    private func text(_ seconds: Double) -> String { ResetCountdown.text(until: now.addingTimeInterval(seconds), now: now) }

    func testFormat() {
        XCTAssertEqual(text(7), "0:00:07", "seconds")
        XCTAssertEqual(text(251), "0:04:11", "minutes")
        XCTAssertEqual(text(9667), "2:41:07", "hours")
        XCTAssertEqual(text(183_851), "2 g 3:04:11", "days")
        XCTAssertEqual(text(86_400), "1 g 0:00:00")
        XCTAssertEqual(text(0.4), "0:00:01", "a partial second still counts")
        XCTAssertEqual(text(0), "adesso")
        XCTAssertEqual(text(-90), "adesso", "past")
        XCTAssertEqual(text(863_999), ResetCountdown.longest, "the widest a weekly window can show")
    }
}
