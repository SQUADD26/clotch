import SwiftUI
import ClotchCore

// The accounts in use on this Mac: three vertical bars (week) with a detail card on hover, and the
// expanded element with two bars per account (5 hours above, week below).

// MARK: - Bars and hover

/// One vertical bar per account in use, filled with its week. The pointer over them asks for the card
/// (`AccountsCardKey`); the panel draws it under the island, outside the island's clip, and holds the
/// notch closed meanwhile (`AccountsHoverKey`).
struct AccountBarsElement: View {
    let data: NotchZoneData
    @State private var hovering = false

    var body: some View {
        let accounts = data.accountsInUse
        if !accounts.isEmpty {
            HStack(spacing: 4) {  // 10 pt pitch
                ForEach(accounts.prefix(4)) { account in
                    let used = account.stale(data.now) ? nil : account.sevenDay.usedNow(data.now)
                    VerticalBar(progress: used.map { $0 / 100 }, color: NotchQuotaTone.color(used: used))
                }
            }
            .frame(height: data.barHeight)
            .contentShape(Rectangle())
            .onHover { hovering = $0 }
            .anchorPreference(key: AccountsCardKey.self, value: .bounds) {
                hovering || data.accountsCardOpen ? AccountsCardRequest(bars: $0, data: data) : nil
            }
            .preference(key: AccountsHoverKey.self, value: hovering)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(accounts.map { AccountText.speech($0, now: data.now) }.joined(separator: ". "))
        }
    }
}

/// The account bars under the pointer: where they are and what the card shows.
struct AccountsCardRequest {
    let bars: Anchor<CGRect>
    let data: NotchZoneData
}

struct AccountsCardKey: PreferenceKey {
    static let defaultValue: AccountsCardRequest? = nil
    static func reduce(value: inout AccountsCardRequest?, nextValue: () -> AccountsCardRequest?) {
        value = value ?? nextValue()
    }
}

/// True while the pointer is on the account bars: the closed notch does not open meanwhile.
struct AccountsHoverKey: PreferenceKey {
    static let defaultValue = false
    static func reduce(value: inout Bool, nextValue: () -> Bool) { value = value || nextValue() }
}

extension View {
    /// Hangs the accounts card 10 pt under the bars that asked for it (Figma 11: 42 from the top), inside
    /// this view's width. Put it on a view that is not clipped to the island; `allowed` is false while the
    /// notch is open or a notification hangs under it, so the card never covers either.
    func accountsCard(allowed: Bool) -> some View {
        overlayPreferenceValue(AccountsCardKey.self) { request in
            GeometryReader { proxy in
                if allowed, let request {
                    let bars = proxy[request.bars]
                    let w = AccountsDetailCard.width
                    AccountsDetailCard(data: request.data)
                        .fixedSize(horizontal: false, vertical: true)
                        .offset(x: min(max(bars.midX - w / 2, 8), proxy.size.width - w - 8), y: bars.maxY + 10)
                        .allowsHitTesting(false)
                        .transition(.opacity)
                }
            }
            .animation(NotchMotion.still, value: allowed && request != nil)
        }
    }
}

/// One account as a 6 × 16 bar filled from the bottom (Figma «Barra in alto»).
private struct VerticalBar: View {
    let progress: Double?
    let color: Color

    var body: some View {
        let bar = RoundedRectangle(cornerRadius: 3, style: .continuous)
        ZStack(alignment: .bottom) {
            bar.fill(GoalInk.barTrack)
            if let progress, progress > 0 {
                bar.fill(color).frame(height: max(4, 16 * CGFloat(min(progress, 1))))
            }
        }
        .frame(width: 6, height: 16)
    }
}

/// «Account in uso su questo Mac»: per account its name, then 5 hours and week, each with bar, figure and
/// the countdown to its reset; a hairline between accounts. Black like the island, white 12% border (Figma 11, widened
/// for the reset column). The rows are the Account tab's `QuotaMeter`.
struct AccountsDetailCard: View {
    let data: NotchZoneData
    static let width: CGFloat = 360

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Account in uso su questo Mac").font(NotchType.small).foregroundStyle(GoalInk.secondary)
            ForEach(Array(data.accountsInUse.enumerated()), id: \.element.id) { index, account in
                if index > 0 { Rectangle().fill(GoalInk.divider).frame(height: 1) }
                VStack(alignment: .leading, spacing: 6) {
                    Text(data.name(of: account))
                        .font(NotchType.name)
                        .foregroundStyle(account.stale(data.now) ? GoalInk.secondary : GoalInk.primary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    if account.stale(data.now) {
                        Text(account.at.map { "Nessun dato da " + GoalRow.elapsed(from: $0, to: data.now) } ?? "Nessun dato")
                            .font(NotchType.small).foregroundStyle(GoalInk.secondary)
                    } else {
                        row("5 ore", account.fiveHour)
                        row("Settimana", account.sevenDay)
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(AccountText.speech(account, now: data.now))
            }
        }
        .padding(16)
        .frame(width: Self.width, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.black))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.white.opacity(0.12), lineWidth: 1))
    }

    private func row(_ name: String, _ window: QuotaWindow) -> some View {
        QuotaMeter(name: name, window: window, now: data.now)
    }
}

// MARK: - Expanded element

/// «Account in uso, esteso»: per account its name and two thin bars, 5 hours above and week below,
/// each with its figure; the week's figure carries the warning colour.
struct AccountsWideElement: View {
    let data: NotchZoneData

    var body: some View {
        let accounts = data.accountsInUse
        if !accounts.isEmpty {
            HStack(spacing: 18) {
                ForEach(accounts) { account in
                    HStack(spacing: 8) {
                        if !data.iconsOnly {
                            Text(data.name(of: account))
                                .font(NotchType.label)
                                .foregroundStyle(account.stale(data.now) ? GoalInk.secondary : Color.white.opacity(0.85))
                                .lineLimit(1)
                        }
                        if account.stale(data.now) {
                            Text("Nessun dato").font(NotchType.caption).foregroundStyle(GoalInk.secondary)
                        } else {
                            VStack(alignment: .leading, spacing: 3) {
                                Row(window: account.fiveHour, now: data.now, toned: false)
                                Row(window: account.sevenDay, now: data.now, toned: true)
                            }
                        }
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(AccountText.speech(account, now: data.now))
                }
            }
        }
    }

    private struct Row: View {
        let window: QuotaWindow
        let now: Date
        let toned: Bool

        var body: some View {
            let used = window.usedNow(now)
            HStack(spacing: 6) {
                GoalBar(progress: used.map { $0 / 100 }, color: NotchQuotaTone.color(used: used), height: 3).frame(width: 30)
                Text(used.map { "\(Int($0.rounded()))%" } ?? "")
                    .font(.system(size: 10, weight: .semibold).monospacedDigit())
                    .foregroundStyle(toned ? NotchQuotaTone.color(used: used) : GoalInk.secondary)
                    .frame(width: 28, alignment: .leading)
            }
        }
    }
}

enum AccountText {
    static func speech(_ account: AccountQuota, now: Date) -> String {
        guard !account.stale(now) else { return account.email + ". Nessun dato recente" }
        func part(_ w: QuotaWindow, _ name: String) -> String {
            w.usedNow(now).map { "\(name) \(Int($0.rounded())) per cento" } ?? "\(name) libero"
        }
        return [account.email, part(account.fiveHour, "5 ore"), part(account.sevenDay, "settimana")].joined(separator: ". ")
    }
}
