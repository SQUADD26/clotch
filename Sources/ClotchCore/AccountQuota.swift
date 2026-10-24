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
    /// `registered`: emails of the accounts set up on this Mac (`RegisteredAccounts`); one the dashboard
    /// does not list yet shows with no reading, so a new account is there before its first turn (#1109).
    public static func parse(_ data: Data, now: Date, registered: [String] = []) -> [AccountQuota]? {
        guard let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let rows = root["rows"] as? [[String: Any]] else { return nil }
        let real = (root["real"] as? [[String: Any]] ?? []).compactMap(row)
        var list = merge(real: real, rows: rows.compactMap(row), now: now)
        let known = Set(list.map(\.email))
        list += registered.filter { !known.contains($0) }.map {
            AccountQuota(email: $0, at: nil, fiveHour: QuotaWindow(used: nil, reset: nil), sevenDay: QuotaWindow(used: nil, reset: nil))
        }
        return order(list, now: now)
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

public enum RegisteredAccounts {
    /// `~/.config/claude-accounts/accounts.json` (the engine's registry, written by `setup`): each account's email, sorted by name.
    public static func emails(from data: Data) -> [String] {
        guard let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let accounts = root["accounts"] as? [String: [String: Any]] else { return [] }
        return accounts.keys.sorted().compactMap { (accounts[$0]?["email"] as? String).flatMap { $0.isEmpty ? nil : $0 } }
    }
}

public enum AccountsInUse {
    /// Each account's desktop app is its own bundle «Claude <email>.app» (file names carry the full-width ＠);
    /// plain «Claude.app» names no account. The email matches a dashboard row exactly, never by label.
    public static func email(bundleName: String) -> String? {
        guard bundleName.hasPrefix("Claude "), bundleName.hasSuffix(".app") else { return nil }
        let email = bundleName.dropFirst(7).dropLast(4).replacingOccurrences(of: "＠", with: "@")
        return email.contains("@") && !email.contains(" ") ? email : nil
    }
}

public enum ResetCountdown {
    /// The widest text `text` gives for a window up to 10 days, for a column that never cuts it.
    public static let longest = "9 g 23:59:59"

    /// Time left to a reset: «2:41:07», «0:04:11», «2 g 3:04:11» past a day; «adesso» once it is due.
    public static func text(until reset: Date, now: Date) -> String {
        let s = Int(reset.timeIntervalSince(now).rounded(.up))
        guard s > 0 else { return "adesso" }
        let (d, h, m, sec) = (s / 86_400, s % 86_400 / 3600, s % 3600 / 60, s % 60)
        let clock = String(format: "%d:%02d:%02d", h, m, sec)
        return d > 0 ? "\(d) g " + clock : clock
    }
}
