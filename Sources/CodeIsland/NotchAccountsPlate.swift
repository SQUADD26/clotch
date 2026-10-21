import SwiftUI
import CodeIslandCore

/// Account usage, as Macchine shows it: the account to use next first, accounts without a reading
/// for a day last and muted, never drawn as bars.
struct AccountsPlate: View {
    @ObservedObject var feed: AccountQuotaFeed
    let now: Date
    static let column: CGFloat = 128

    var body: some View {
        let accounts = feed.accounts
        // Two logins can share the part before the @: those show the whole email.
        let repeated = Set(Dictionary(grouping: accounts, by: \.label).filter { $0.value.count > 1 }.keys)
        Plate(title: "Account") {
            if accounts.contains(where: { !$0.stale(now) }) {
                HStack(spacing: NotchSpace.plate) {
                    Text("5 ore").frame(width: Self.column, alignment: .leading)
                    Text("Settimana").frame(width: Self.column, alignment: .leading)
                }
                .font(NotchType.label)
                .foregroundStyle(GoalInk.secondary)
            }
        } content: {
            if accounts.isEmpty {
                EmptyState(text: feed.lastFetchFailed ? "Uso non disponibile" : "Caricando...")
            } else {
                VStack(alignment: .leading, spacing: NotchSpace.row) {
                    ForEach(accounts) { account in
                        AccountLine(account: account, name: repeated.contains(account.label) ? account.email : account.label,
                                    now: now)
                    }
                    if let age = staleness {
                        Text(age).font(NotchType.caption).foregroundStyle(GoalInk.secondary)
                    }
                }
            }
        }
    }

    /// The list is the last good one: say its age when a refresh failed or it is over 2 minutes old.
    private var staleness: String? {
        guard let at = feed.fetchedAt, feed.lastFetchFailed || now.timeIntervalSince(at) > 120 else { return nil }
        return "Aggiornato " + GoalRow.elapsed(from: at, to: now) + " fa"
    }
}

private struct AccountLine: View {
    let account: AccountQuota
    let name: String
    let now: Date

    var body: some View {
        let stale = account.stale(now)
        HStack(spacing: NotchSpace.plate) {
            Text(name)
                .font(NotchType.bodyEmphasis)
                .foregroundStyle(stale ? GoalInk.secondary : GoalInk.primary)
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: .infinity, alignment: .leading)
                .help(account.email)
            if stale {
                Text(account.at.map { "Nessun dato da " + GoalRow.elapsed(from: $0, to: now) } ?? "Nessun dato")
                    .font(NotchType.secondary)
                    .foregroundStyle(GoalInk.secondary)
                    .frame(width: AccountsPlate.column * 2 + NotchSpace.plate, alignment: .leading)
            } else {
                QuotaMeter(window: account.fiveHour, now: now).frame(width: AccountsPlate.column)
                QuotaMeter(window: account.sevenDay, now: now).frame(width: AccountsPlate.column)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText(stale: stale))
    }

    private func accessibilityText(stale: Bool) -> String {
        guard !stale else { return account.email + ". Nessun dato recente" }
        func part(_ w: QuotaWindow, _ name: String) -> String {
            w.usedNow(now).map { "\(name) \(Int($0.rounded())) per cento" } ?? "\(name) libero"
        }
        return [account.email, part(account.fiveHour, "5 ore"), part(account.sevenDay, "settimana")].joined(separator: ". ")
    }
}

private struct QuotaMeter: View {
    let window: QuotaWindow
    let now: Date

    var body: some View {
        // Macchine's rule: no reading, or the window already reset, is no percentage (the bar stays empty).
        let used = window.usedNow(now)
        HStack(spacing: NotchSpace.row) {
            GoalBar(progress: used.map { $0 / 100 }, color: color(used), height: 4)
            Text(used.map { "\(Int($0.rounded()))%" } ?? "")
                .font(NotchType.numbers)
                .foregroundStyle(GoalInk.primary)
                .lineLimit(1)
                .frame(width: NotchSpace.figureColumn, alignment: .trailing)
                .contentTransition(.numericText())
        }
    }

    /// Plenty left is plain white; the colour only warns.
    private func color(_ used: Double?) -> Color {
        guard let used else { return GoalInk.secondary }
        return used >= 90 ? GoalTone.stop.color : used >= 70 ? GoalTone.wait.color : Color.white.opacity(0.85)
    }
}
