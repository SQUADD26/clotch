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
    /// «Solo icone» in the layout: elements drop their words.
    var iconsOnly = false
    /// A notification folding back into the notch: its result symbol stands in the right zone a moment.
    var mark: NotchEvent?

    /// The accounts in use here, in the dashboard's «next to use» order.
    var accountsInUse: [AccountQuota] { accounts.filter { inUse.contains($0.email) } }

    /// The part before the @; two logins that share it show the whole email.
    func name(of account: AccountQuota) -> String {
        accounts.filter { $0.label == account.label }.count > 1 ? account.email : account.label
    }
}

/// The colour a usage figure gets (Figma specs): green with room, yellow from 50%, red from 90%.
enum NotchQuotaTone {
    static func tone(used: Double?) -> GoalTone? {
        guard let used else { return nil }
        return used >= 90 ? .stop : used >= 50 ? .wait : .go
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

    static let spacing: CGFloat = 14  // between elements of one zone
    static let margin: CGFloat = 10.5  // each side of a zone: 4 rings fill the 84 pt Figma wing exactly

    /// Each wing of the closed notch: the wider side's elements, never narrower than the Figma wing.
    static func wing(_ layout: NotchScreenLayout) -> CGFloat {
        max(NotchSize.wing, width(of: layout.left, layout), width(of: layout.right, layout))
    }

    /// The room a zone's elements take, margins included; 0 with none.
    static func width(of elements: [NotchElement], _ layout: NotchScreenLayout) -> CGFloat {
        guard !elements.isEmpty else { return 0 }
        let words = layout.iconsOnly != true
        // shortcut: fixed estimates per element (titles and names vary), measure them if one gets clipped.
        let sum = elements.reduce(CGFloat(0)) { total, element in
            switch element {
            case .goalRings: return total + 63  // 4 rings of 12, centres 17 apart
            case .accounts: return total + 36  // up to 4 bars of 6, 10 apart
            case .activeGoal: return total + (words ? 220 : 80)
            case .accountsWide: return total + (words ? 330 : 150)
            case .pendingRequests, .workingSessions: return total + 36
            }
        }
        return sum + CGFloat(elements.count - 1) * spacing + 2 * margin
    }
}
