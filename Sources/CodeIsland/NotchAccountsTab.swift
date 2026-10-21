import SwiftUI
import CodeIslandCore

/// The «Account» tab of the open notch, under the tab bar the shell draws: a header, then one card per
/// account in two columns, 5 hours and week each. A laptop marks the accounts running on this Mac; an
/// account with no reading for a day is muted and says how long.
struct AccountsTab: View {
    let accounts: [AccountQuota]
    let inUse: Set<String>
    let now: Date
    /// When the list was read, and whether the last refresh failed: the list is the last good one.
    var fetchedAt: Date? = nil
    var fetchFailed = false

    private var names: NotchZoneData { NotchZoneData(accounts: accounts, inUse: inUse, now: now) }
    private var inUseCount: Int { accounts.filter { inUse.contains($0.email) }.count }

    static func inUseText(_ count: Int) -> String {
        count == 0 ? "Nessuno in uso su questo Mac" : "\(count) in uso su questo Mac"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: NotchSpace.head) {
            HStack(spacing: 6) {
                Label("Account", systemImage: "person.2")
                Spacer(minLength: NotchSpace.row)
                Label(Self.inUseText(inUseCount), systemImage: "laptopcomputer")
            }
            .font(NotchType.secondary)
            .foregroundStyle(GoalInk.secondary)

            if accounts.isEmpty {
                EmptyState(text: fetchFailed ? "Uso non disponibile" : "Caricando...")
            } else {
                Grid(horizontalSpacing: NotchSpace.row, verticalSpacing: NotchSpace.row) {
                    ForEach(Array(stride(from: 0, to: accounts.count, by: 2)), id: \.self) { i in
                        GridRow {
                            card(accounts[i])
                            if i + 1 < accounts.count { card(accounts[i + 1]) } else { Color.clear }
                        }
                    }
                }
                if let age = staleness {
                    Text(age).font(NotchType.caption).foregroundStyle(GoalInk.secondary)
                }
            }
        }
        .padding(.horizontal, NotchSpace.inset)
        .padding(.bottom, NotchSpace.inset)
    }

    private func card(_ account: AccountQuota) -> some View {
        AccountCard(account: account, name: names.name(of: account), onThisMac: inUse.contains(account.email), now: now)
    }

    /// Its age when a refresh failed or the list is over 2 minutes old.
    private var staleness: String? {
        guard let at = fetchedAt, fetchFailed || now.timeIntervalSince(at) > 120 else { return nil }
        return "Aggiornato " + GoalRow.elapsed(from: at, to: now) + " fa"
    }
}

/// `AccountsTab` on the live feeds. The caller gives `now` (its own TimelineView, open notch only).
struct AccountsTabLive: View {
    let now: Date
    @ObservedObject private var quota = AccountQuotaFeed.shared
    @ObservedObject private var inUse = AccountsInUseFeed.shared

    var body: some View {
        AccountsTab(accounts: quota.accounts, inUse: inUse.emails, now: now,
                    fetchedAt: quota.fetchedAt, fetchFailed: quota.lastFetchFailed)
    }
}

private struct AccountCard: View {
    let account: AccountQuota
    let name: String
    let onThisMac: Bool
    let now: Date

    var body: some View {
        let stale = account.stale(now)
        VStack(alignment: .leading, spacing: NotchSpace.tight) {
            HStack(spacing: NotchSpace.row) {
                Text(name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(stale ? GoalInk.secondary : GoalInk.primary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer(minLength: 0)
                if onThisMac {
                    Image(systemName: "laptopcomputer").font(.system(size: 12)).foregroundStyle(GoalInk.secondary)
                }
            }
            if stale {
                Text(account.at.map { "Nessun dato da " + GoalRow.elapsed(from: $0, to: now) } ?? "Nessun dato")
                    .font(NotchType.secondary).foregroundStyle(GoalInk.secondary)
            } else {
                Line(title: "5 ore", window: account.fiveHour, now: now)
                Line(title: "Settimana", window: account.sevenDay, now: now)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white.opacity(0.07)))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(AccountText.speech(account, now: now) + (onThisMac ? ". In uso su questo Mac" : ""))
    }

    /// One window: a label, its bar (the warning colour), its figure (red only at the stop level).
    private struct Line: View {
        let title: String
        let window: QuotaWindow
        let now: Date

        var body: some View {
            let used = window.usedNow(now)
            HStack(spacing: NotchSpace.row) {
                Text(title).font(NotchType.secondary).foregroundStyle(GoalInk.secondary)
                    .frame(width: 62, alignment: .leading)
                GoalBar(progress: used.map { $0 / 100 }, color: NotchQuotaTone.color(used: used), height: 4)
                Text(used.map { "\(Int($0.rounded()))%" } ?? "")
                    .font(NotchType.numbers)
                    .foregroundStyle(NotchQuotaTone.tone(used: used) == .stop ? GoalTone.stop.color : GoalInk.primary)
                    .frame(width: NotchSpace.figureColumn, alignment: .trailing)
            }
        }
    }
}
