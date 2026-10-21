import SwiftUI
import CodeIslandCore

/// The Accounts tab: one card per account in Macchine's "next to use" order, with its 5-hour and weekly
/// usage. The accounts whose Claude app runs on this Mac carry the Mac mark.
struct AccountsTab: View {
    @ObservedObject var feed: AccountQuotaFeed
    @ObservedObject var inUse: AccountsInUseFeed
    let now: Date
    @State private var page = 0
    static let perPage = 4

    var body: some View {
        let accounts = feed.accounts
        // Two logins can share the part before the @: those show the whole email.
        let repeated = Set(Dictionary(grouping: accounts, by: \.label).filter { $0.value.count > 1 }.keys)
        let used = accounts.filter { inUse.emails.contains($0.email) }.count
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                IconLabel(symbol: "person.2", text: "Account")
                Spacer()
                if used > 0 { IconLabel(symbol: "laptopcomputer", text: "\(used) in uso su questo Mac", font: NotchType.label) }
            }
            if accounts.isEmpty {
                EmptyState(text: feed.lastFetchFailed ? "Uso non disponibile" : "Caricando...")
            } else {
                // Paged like the other tabs: 2 rows of 2, as in the Figma, however many accounts there are.
                let pages = (accounts.count + Self.perPage - 1) / Self.perPage
                let index = Binding<Int>(get: { min(page, pages - 1) }, set: { page = $0 })
                Pager(count: pages, index: index) { p in
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        ForEach(accounts.dropFirst(p * Self.perPage).prefix(Self.perPage)) { account in
                            AccountCard(account: account, name: repeated.contains(account.label) ? account.email : account.label,
                                        inUse: inUse.emails.contains(account.email), now: now)
                        }
                    }
                } footer: { go in
                    if pages > 1 { PageControl(count: pages, index: index.wrappedValue, go: go) }
                }
                if let age = staleness {
                    Text(age).font(NotchType.label).foregroundStyle(GoalInk.secondary)
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

private struct AccountCard: View {
    let account: AccountQuota
    let name: String
    let inUse: Bool
    let now: Date

    var body: some View {
        let stale = account.stale(now)
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(name)
                    .font(NotchType.name)
                    .foregroundStyle(stale ? GoalInk.secondary : GoalInk.primary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer(minLength: 4)
                if inUse { Image(systemName: "laptopcomputer").font(.system(size: 14)).foregroundStyle(GoalInk.off) }
            }
            if stale {
                Text(account.at.map { "Nessun dato da " + GoalRow.elapsed(from: $0, to: now) } ?? "Nessun dato")
                    .font(NotchType.label)
                    .foregroundStyle(GoalInk.secondary)
            } else {
                QuotaMeter(name: "5 ore", window: account.fiveHour, now: now)
                QuotaMeter(name: "Settimana", window: account.sevenDay, now: now)
            }
        }
        .padding(.horizontal, 14)
        .frame(height: 70)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(inUse ? GoalInk.cardInUse : GoalInk.card))
        .help(account.email)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText(stale: stale))
    }

    private func accessibilityText(stale: Bool) -> String {
        guard !stale else { return account.email + ". Nessun dato recente" }
        func part(_ w: QuotaWindow, _ name: String) -> String {
            w.usedNow(now).map { "\(name) \(Int($0.rounded())) per cento" } ?? "\(name) libero"
        }
        return ([account.email] + (inUse ? ["In uso su questo Mac"] : [])
                + [part(account.fiveHour, "5 ore"), part(account.sevenDay, "settimana")]).joined(separator: ". ")
    }
}

/// «5 ore ▬▬── 4%»: no reading, or the window already reset, is no percentage (Macchine's rule).
struct QuotaMeter: View {
    let name: String
    let window: QuotaWindow
    let now: Date

    var body: some View {
        let used = window.usedNow(now)
        HStack(spacing: 8) {
            Text(name).font(NotchType.small).foregroundStyle(GoalInk.secondary).frame(width: 64, alignment: .leading)
            GoalBar(progress: used.map { $0 / 100 }, color: NotchQuotaTone.color(used: used), height: 4)
            Text(used.map { "\(Int($0.rounded()))%" } ?? "")
                .font(.system(size: 11, weight: (used ?? 0) >= 90 ? .semibold : .regular).monospacedDigit())
                .foregroundStyle((used ?? 0) >= 90 ? GoalTone.stop.color : GoalInk.row)
                .frame(width: 36, alignment: .trailing)
                .contentTransition(.numericText())
        }
    }
}
