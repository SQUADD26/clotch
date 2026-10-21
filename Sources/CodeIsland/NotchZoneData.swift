import SwiftUI
import CodeIslandCore

/// Everything the zone views draw, as plain values: the live wrapper fills it from the stores, the
/// snapshot tests fill it with fixtures.
struct NotchZoneData {
    var rows: [GoalRow] = []
    var accounts: [AccountQuota] = []
    /// Emails of the accounts whose desktop app runs on this Mac (`AccountsInUseFeed`).
    var inUse: Set<String> = []
    var requestsWaiting = 0
    var workingSessions = 0
    /// Start of work on the goal chased now. nil = no source gives it yet: the counter is left out, never invented.
    var workingSince: Date?
    var now = Date()
    /// Height of the bar the zones sit in (the notch height): the hover card hangs under it.
    var barHeight: CGFloat = 32

    /// The accounts in use here, in the dashboard's «next to use» order.
    var accountsInUse: [AccountQuota] { accounts.filter { inUse.contains($0.email) } }

    /// The part before the @; two logins that share it show the whole email.
    func name(of account: AccountQuota) -> String {
        accounts.filter { $0.label == account.label }.count > 1 ? account.email : account.label
    }
}

/// The colour a usage figure gets. Figma shows 25% green and 61–63% yellow, so yellow starts at 50.
enum NotchQuotaTone {
    static func tone(used: Double?) -> GoalTone? {
        guard let used else { return nil }
        return used >= 80 ? .stop : used >= 50 ? .wait : .go
    }

    static func color(used: Double?) -> Color { tone(used: used)?.color ?? GoalInk.secondary }
}

enum NotchLayoutMetrics {
    /// How wide the island is for `NotchScreenLayout.width`: 0 = the hardware (or simulated) notch alone,
    /// 1 = 90% of the screen.
    static func islandWidth(fraction: Double, screenWidth: CGFloat, notchWidth: CGFloat) -> CGFloat {
        let widest = max(notchWidth, screenWidth * 0.9)
        return notchWidth + CGFloat(min(max(fraction, 0), 1)) * (widest - notchWidth)
    }
}
