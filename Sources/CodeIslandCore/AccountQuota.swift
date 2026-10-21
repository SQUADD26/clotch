import Foundation

// Account usage for the notch, from the dashboard Roberto's Macchine app reads
// (GET https://claude.squaddbackend.com/dashboard/data, public, no token). Pure: the caller fetches
// and passes `now`. The rules are Macchine's (Consumi.swift), so both apps show the same numbers.

/// One quota window (5 hours or 7 days) as the dashboard reports it.
public struct QuotaWindow: Equatable, Sendable {
    public let used: Double?    // percent as reported
    public let reset: Date?

    /// No data, or the window already reset: no percentage.
    public func usedNow(_ now: Date) -> Double? {
        guard let used, !(reset.map { $0 <= now } ?? false) else { return nil }
        return max(0, min(100, used))
    }

    /// What is left; a window that reset since the reading is whole again.
    public func leftNow(_ now: Date) -> Double? {
        usedNow(now).map { 100 - $0 } ?? (used != nil && reset != nil ? 100 : nil)
    }
}

public struct AccountQuota: Identifiable, Equatable, Sendable {
    public let email: String
    public let at: Date?        // when the numbers were read ("ts"; 0 = never)
    public let fiveHour: QuotaWindow
    public let sevenDay: QuotaWindow

    public var id: String { email }
    /// How Macchine names an account: the part of the email before the @.
    public var label: String { email.split(separator: "@").first.map(String.init) ?? email }

    public func age(_ now: Date) -> TimeInterval { at.map { now.timeIntervalSince($0) } ?? .infinity }
    /// A day without a reading: the numbers are no longer shown.
    public func stale(_ now: Date) -> Bool { age(now) >= 86_400 }
}

public enum AccountQuotas {
    /// The dashboard's JSON, merged and in Macchine's "next to use" order; nil when unreadable.
    public static func parse(_ data: Data, now: Date) -> [AccountQuota]? {
        guard let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let rows = root["rows"] as? [[String: Any]] else { return nil }
        let real = (root["real"] as? [[String: Any]] ?? []).compactMap(row)
        return order(merge(real: real, rows: rows.compactMap(row), now: now), now: now)
    }

    static func row(_ d: [String: Any]) -> AccountQuota? {
        guard let email = d["email"] as? String, !email.isEmpty else { return nil }
        func number(_ key: String) -> Double? { (d[key] as? NSNumber)?.doubleValue }
        func date(_ key: String) -> Date? { number(key).flatMap { $0 > 0 ? Date(timeIntervalSince1970: $0) : nil } }
        return AccountQuota(email: email, at: date("ts"),
                            fiveHour: QuotaWindow(used: number("five_used"), reset: date("five_resets")),
                            sevenDay: QuotaWindow(used: number("seven_used"), reset: date("seven_resets")))
    }

    /// A direct reading ("real") wins, until it is 10 minutes old and a host row is newer.
    static func merge(real: [AccountQuota], rows: [AccountQuota], now: Date) -> [AccountQuota] {
        var all: [String: (row: AccountQuota, real: Bool)] = [:]
        for q in real { all[q.email] = (q, true) }
        for r in rows {
            let empty = AccountQuota(email: r.email, at: nil, fiveHour: QuotaWindow(used: nil, reset: nil),
                                     sevenDay: QuotaWindow(used: nil, reset: nil))
            var a = all[r.email] ?? (empty, false)
            let ts = { (q: AccountQuota) in q.at?.timeIntervalSince1970 ?? 0 }
            if a.real && now.timeIntervalSince1970 - ts(a.row) >= 600 && ts(r) > ts(a.row) { a.real = false }
            if !a.real && ts(r) >= ts(a.row) { a.row = r }
            all[r.email] = a
        }
        return all.values.map(\.row)
    }

    /// Fresh before stale; then the account to use next: plenty left first, nearly spent ones after,
    /// ordered by when they come back.
    static func order(_ list: [AccountQuota], now: Date) -> [AccountQuota] {
        func key(_ q: AccountQuota) -> (Int, Int, Double, Double) {
            let five = q.fiveHour.leftNow(now), seven = q.sevenDay.leftNow(now)
            let tier = (seven ?? 100) < 5 ? 2 : (five ?? 100) < 5 ? 1 : 0
            let reset = tier == 2 ? q.sevenDay.reset : q.fiveHour.reset
            let k = tier == 0 ? -min(five ?? 50, seven ?? 50) : (reset?.timeIntervalSince1970 ?? .infinity)
            return (q.stale(now) ? 1 : 0, tier, k, -q.age(now))
        }
        return list.sorted { a, b in
            let (ka, kb) = (key(a), key(b))
            return ka != kb ? ka < kb : a.email < b.email
        }
    }
}
