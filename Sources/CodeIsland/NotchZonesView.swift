import SwiftUI

/// The three zones of the closed notch, read from the layout stored by «Personalizza il notch».
/// Beside a hardware notch only the sides draw and the middle is the gap; on a screen without one the
/// centre zone is used too. The black island and its width are the caller's.
struct NotchZonesView: View {
    let layout: NotchScreenLayout
    let hasNotch: Bool
    /// The hardware notch, left empty; unused without one.
    let notchWidth: CGFloat
    let data: NotchZoneData

    var body: some View {
        let zones = layout.resolved(hasNotch: hasNotch)
        HStack(spacing: 0) {
            zone(zones.left).frame(maxWidth: .infinity, alignment: .leading)
            if hasNotch {
                Color.clear.frame(width: notchWidth)
            } else {
                zone(zones.centre).fixedSize()
            }
            zone(zones.right).frame(maxWidth: .infinity, alignment: .trailing)
        }
        .frame(height: data.barHeight)
    }

    private func zone(_ elements: [NotchElement]) -> some View {
        HStack(spacing: 14) {
            ForEach(elements, id: \.self) { NotchElementView(element: $0, data: data) }
        }
        .padding(.horizontal, 14)
    }
}

/// `NotchZonesView` on the live stores. Redraws only when a store publishes; nothing here runs on a timer.
struct NotchLiveZones: View {
    let layout: NotchScreenLayout
    let hasNotch: Bool
    let notchWidth: CGFloat
    var workingSince: Date? = nil
    var barHeight: CGFloat = 32

    @ObservedObject private var store = GoalStore.shared
    @ObservedObject private var quota = AccountQuotaFeed.shared
    @ObservedObject private var inUse = AccountsInUseFeed.shared

    var body: some View {
        NotchZonesView(
            layout: layout, hasNotch: hasNotch, notchWidth: notchWidth,
            data: NotchZoneData(
                rows: store.rows, accounts: quota.accounts, inUse: inUse.emails,
                requestsWaiting: store.requests.filter { !$0.taken }.count,
                workingSessions: store.rows.allPulses.filter(\.running).count,
                workingSince: workingSince, now: store.now, barHeight: barHeight
            )
        )
    }
}
