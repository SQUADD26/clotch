import SwiftUI
import CodeIslandCore

// The accounts in use on this Mac: three vertical bars (week) with a detail card on hover, and the
// expanded element with two bars per account (5 hours above, week below).

// MARK: - Bars and hover

/// One vertical bar per account in use, filled with its week. The pointer over them opens the card
/// with account, 5 hours and week; the card hangs 8 pt under the bar the zones sit in.
struct AccountBarsElement: View {
    let data: NotchZoneData
    @State private var hovering = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let accounts = data.accountsInUse
        if !accounts.isEmpty {
            HStack(spacing: 3) {
                ForEach(accounts) { account in
                    let used = account.stale(data.now) ? nil : account.sevenDay.usedNow(data.now)
                    VerticalBar(progress: used.map { $0 / 100 }, color: NotchQuotaTone.color(used: used))
                }
            }
            .frame(height: data.barHeight)
            .contentShape(Rectangle())
            .onHover { hovering = $0 }
            .overlay(alignment: .bottom) {
                if hovering {
                    AccountsDetailCard(data: data)
                        .fixedSize()
                        .allowsHitTesting(false)
                        .alignmentGuide(.bottom) { $0[.top] - 8 }
                        .transition(reduceMotion ? .opacity : .opacity.combined(with: .scale(scale: 0.96, anchor: .top)))
                }
            }
            .animation(reduceMotion ? nil : NotchAnimation.close, value: hovering)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(accounts.map { AccountText.speech($0, now: data.now) }.joined(separator: ". "))
        }
    }
}

private struct VerticalBar: View {
    let progress: Double?
    let color: Color

    var body: some View {
        ZStack(alignment: .bottom) {
            Capsule().fill(GoalInk.track)
            if let progress, progress > 0 {
                Capsule().fill(color).frame(height: max(6, 18 * CGFloat(min(progress, 1))))
            }
        }
        .frame(width: 6, height: 18)
    }
}

/// «Account in uso su questo Mac»: per account its name, then 5 hours and week with a bar and a figure each.
struct AccountsDetailCard: View {
    let data: NotchZoneData
    private static let barWidth: CGFloat = 76

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Account in uso su questo Mac").font(NotchType.secondary).foregroundStyle(GoalInk.secondary)
            ForEach(data.accountsInUse) { account in
                VStack(alignment: .leading, spacing: NotchSpace.tight) {
                    Text(data.name(of: account))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(account.stale(data.now) ? GoalInk.secondary : GoalInk.primary)
                        .lineLimit(1)
                    if account.stale(data.now) {
                        Text(account.at.map { "Nessun dato da " + GoalRow.elapsed(from: $0, to: data.now) } ?? "Nessun dato")
                            .font(NotchType.secondary).foregroundStyle(GoalInk.secondary)
                    } else {
                        HStack(spacing: 24) {
                            Meter(title: "5 ore", window: account.fiveHour, now: data.now, toned: false)
                            Meter(title: "Sett.", window: account.sevenDay, now: data.now, toned: true)
                        }
                    }
                }
            }
        }
        .padding(NotchSpace.plate)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.black))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Color.white.opacity(0.16), lineWidth: 1))
    }

    private struct Meter: View {
        let title: String
        let window: QuotaWindow
        let now: Date
        /// The week's bar and figure take the warning colour; the 5 hours stay plain.
        let toned: Bool

        var body: some View {
            let used = window.usedNow(now)
            HStack(spacing: 8) {
                Text(title).font(NotchType.label).foregroundStyle(GoalInk.secondary)
                GoalBar(progress: used.map { $0 / 100 }, color: NotchQuotaTone.color(used: used), height: 4)
                    .frame(width: AccountsDetailCard.barWidth)
                Text(used.map { "\(Int($0.rounded()))%" } ?? "")
                    .font(NotchType.numbers)
                    .foregroundStyle(toned ? NotchQuotaTone.color(used: used) : GoalInk.primary)
                    .frame(width: NotchSpace.figureColumn, alignment: .trailing)
            }
        }
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
                        Text(data.name(of: account))
                            .font(NotchType.bodyEmphasis)
                            .foregroundStyle(account.stale(data.now) ? GoalInk.secondary : GoalInk.primary)
                            .lineLimit(1)
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
