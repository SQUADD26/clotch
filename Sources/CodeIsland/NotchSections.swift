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
            NotchSectionsContent(store: store, quota: quota)
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

    var body: some View {
        GlassGroup(spacing: NotchSpace.inset) {
            VStack(spacing: NotchSpace.inset) {
                AccountsPlate(feed: quota, now: store.now)
                GoalPlate(rows: store.rows, now: store.now)
                RequestsPlate(requests: store.requests, active: store.requestsFolderExists)
            }
        }
        .padding([.horizontal, .bottom], NotchSpace.inset)
    }
}

// MARK: - Scale

/// One spacing scale on a 4/8 pt grid. The island's bottom corners are 24 pt; plates sit 8 pt in,
/// so their 16 pt corners are concentric with it (HIG: concentric margins).
enum NotchSpace {
    static let inset: CGFloat = 8      // panel edge to plate, plate to plate
    static let plate: CGFloat = 16     // inside a plate
    static let radius: CGFloat = 16
    static let head: CGFloat = 12      // plate title to its content
    static let row: CGFloat = 8        // between rows
    static let tight: CGFloat = 4      // a line and what belongs to it (bar and its reason)
}

/// One type scale (macOS text styles in points): 11 labels, 12 secondary, 13 body, 15 title, 22 figure.
enum NotchType {
    static let label = Font.system(size: 11, weight: .semibold)
    static let caption = Font.system(size: 11, weight: .medium)
    static let numbers = Font.system(size: 11, weight: .semibold).monospacedDigit()
    static let secondary = Font.system(size: 12)
    static let body = Font.system(size: 13)
    static let bodyEmphasis = Font.system(size: 13, weight: .medium)
    static let title = Font.system(size: 15, weight: .semibold)
    static let figure = Font.system(size: 22, weight: .semibold, design: .rounded).monospacedDigit()
    static let figureUnit = Font.system(size: 13, weight: .medium, design: .rounded).monospacedDigit()
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
