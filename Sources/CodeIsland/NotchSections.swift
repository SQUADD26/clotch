import SwiftUI
import CodeIslandCore

/// The open notch: three glass plates in Roberto's order (accounts, the goal chased now, his requests).
struct NotchSections: View {
    let maxHeight: CGFloat
    @ObservedObject private var store = GoalStore.shared
    @ObservedObject private var quota = AccountQuotaFeed.shared
    @State private var contentHeight: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            // Ticks only while the notch is open: the "since …" text is the only thing time moves.
            TimelineView(.periodic(from: .now, by: 30)) { ctx in
                NotchSectionsContent(store: store, quota: quota, now: ctx.date)
            }
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
        }
        .frame(height: min(contentHeight, maxHeight))
        .animation(reduceMotion ? nil : NotchAnimation.close, value: contentHeight)
        .onAppear { quota.refresh() }  // opening the notch is when fresh numbers matter
    }
}

/// The plates without the scroll view: `--snapshot` draws this (ImageRenderer skips ScrollView content).
struct NotchSectionsContent: View {
    @ObservedObject var store: GoalStore
    @ObservedObject var quota: AccountQuotaFeed
    let now: Date

    var body: some View {
        GlassGroup(spacing: NotchSpace.inset) {
            VStack(spacing: NotchSpace.inset) {
                AccountsPlate(feed: quota, now: now)
                GoalPlate(rows: store.rows, now: now)
                RequestsPlate(requests: store.requests, active: store.requestsFolderExists)
            }
        }
        .padding([.horizontal, .bottom], NotchSpace.inset)
    }
}

// MARK: - Plate parts

/// A plate: title row (with an optional trailing note), then the content, inside one glass shape.
struct Plate<Trailing: View, Content: View>: View {
    let title: String
    var tint: Color? = nil
    @ViewBuilder var trailing: Trailing
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: NotchSpace.head) {
            HStack(alignment: .firstTextBaseline, spacing: NotchSpace.row) {
                Text(title).font(NotchType.label).foregroundStyle(GoalInk.secondary)
                Spacer(minLength: NotchSpace.row)
                trailing
            }
            content
        }
        .padding(NotchSpace.plate)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassPlate(radius: NotchSpace.radius, tint: tint)
    }
}

/// An empty state: what is (or is not) there, and at most one line on why.
struct EmptyState: View {
    let text: String
    var detail: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: NotchSpace.tight) {
            Text(text).font(NotchType.bodyEmphasis).foregroundStyle(GoalInk.secondary)
            if let detail { Text(detail).font(NotchType.secondary).foregroundStyle(GoalInk.secondary) }
        }
    }
}
