import SwiftUI
import CodeIslandCore

// The pull requests under a goal (Figma A3, approved): open ones only, one line each: icon, number, title,
// state. A PR just merged shows once in purple («Unita») with one spring, then leaves.

/// What a PR state looks like and says. Colours are Apple's dark-appearance system tints, like `GoalTone`.
struct PRLook: Equatable {
    let symbol: String
    let color: Color
    let label: String
    var conflict = false

    static let purple = Color(red: 191 / 255, green: 90 / 255, blue: 242 / 255)
    static let orange = Color(red: 1, green: 159 / 255, blue: 10 / 255)

    init(_ state: PRState) {
        switch state {
        case .green: self.init("arrow.triangle.pull", GoalTone.go.color, "Verde")
        case .pending: self.init("arrow.triangle.pull", GoalTone.wait.color, "In corso")
        case .red: self.init("arrow.triangle.pull", GoalTone.stop.color, "Rosso")
        case .conflict: self.init("arrow.triangle.pull", Self.orange, "Conflitto", conflict: true)
        case .merged: self.init("arrow.triangle.merge", Self.purple, "Unita")
        case .closed: self.init("arrow.triangle.pull", GoalInk.secondary, "Chiusa")  // never listed: closed PRs are dropped upstream
        }
    }

    private init(_ symbol: String, _ color: Color, _ label: String, conflict: Bool = false) {
        self.symbol = symbol; self.color = color; self.label = label; self.conflict = conflict
    }
}

/// One PR line. A merged one carries the purple band the design shows.
struct GoalPRRow: View {
    let info: PRInfo

    var body: some View {
        let look = PRLook(info.state)
        HStack(spacing: NotchSpace.row) {
            Image(systemName: look.symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(look.color)
                .overlay(alignment: .bottomTrailing) {
                    if look.conflict { Image(systemName: "xmark").font(.system(size: 7, weight: .heavy)).offset(x: 3, y: 3) }
                }
                .frame(width: 18)
            Text("#\(info.ref.number)")
                .font(NotchType.body.monospacedDigit())
                .foregroundStyle(GoalInk.secondary)
                .frame(minWidth: 30, alignment: .leading)
            Text(info.title)
                .font(NotchType.body)
                .foregroundStyle(GoalInk.primary)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(look.label)
                .font(NotchType.label)
                .foregroundStyle(look.color)
                .fixedSize()
        }
        .padding(.horizontal, NotchSpace.row)
        .padding(.vertical, 5)
        .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(info.state == .merged ? PRLook.purple.opacity(0.14) : .clear))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Pull request \(info.ref.number), \(info.title), \(look.label)")
    }
}

/// The section: «Pull request» and the lines, open ones first (newest number first), then the merged ones
/// still on their way out. Nothing at all when there is nothing to show. Pure: the data comes in, so
/// previews and snapshots feed it fixtures.
struct GoalPRList: View {
    let open: [PRInfo]
    let merged: [PRInfo]
    var onMergedShown: (PRRef) -> Void = { _ in }
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// How long a merged PR stays in purple before it leaves.
    private static let mergedStay: Duration = .seconds(2.5)

    var body: some View {
        let motion: Animation? = reduceMotion ? nil : NotchAnimation.close
        let rows = open.sorted { $0.ref.number > $1.ref.number } + merged
        VStack(alignment: .leading, spacing: 0) {
            if !rows.isEmpty {
                Label("Pull request", systemImage: "arrow.triangle.branch")
                    .font(NotchType.secondary)
                    .foregroundStyle(GoalInk.secondary)
                    .padding(.bottom, NotchSpace.tight)
                ForEach(rows, id: \.ref) { info in
                    GoalPRRow(info: info)
                        .transition(reduceMotion ? .opacity : .opacity.combined(with: .scale(scale: 0.96, anchor: .leading)))
                        .task(id: info.state == .merged ? info.ref : nil) {
                            guard info.state == .merged else { return }
                            // Cancelled when the notch closes: the event waits for the next opening.
                            try? await Task.sleep(for: Self.mergedStay)
                            guard !Task.isCancelled else { return }
                            withAnimation(motion) { onMergedShown(info.ref) }
                        }
                }
            }
        }
        .padding(.horizontal, -NotchSpace.row)  // the rows' own inset lets a band reach past the text column
        .animation(motion, value: rows.map(\.ref))
    }
}

/// The section of one goal, from the live feed. `goal` is `GoalRow.id`.
struct GoalPRSection: View {
    let goal: String
    @ObservedObject private var feed = PullRequestFeed.shared

    var body: some View {
        GoalPRList(open: feed.openByGoal[goal] ?? [], merged: feed.merged(for: goal), onMergedShown: feed.mergedAnimationShown)
    }
}

#if DEBUG
#Preview("Pull request di un obiettivo") {
    GoalPRList(open: GoalPRFixtures.open, merged: GoalPRFixtures.merged)
        .padding(24).frame(width: 520).background(.black)
}

/// Fixture data of Figma A3: one PR per state.
enum GoalPRFixtures {
    private static func pr(_ n: Int, _ title: String, _ state: PRState) -> PRInfo {
        PRInfo(ref: PRRef(repo: "SQUADD26/goal-notch", number: n), title: title, url: "https://github.com/SQUADD26/goal-notch/pull/\(n)", state: state)
    }
    static let open = [
        pr(5, "Notch: disegno in Figma", .pending),
        pr(6, "Notch: dati veri delle PR", .green),
        pr(7, "Notch: scorrimento orizzontale", .red),
        pr(8, "Notch: voce, luce sul bordo", .conflict),
    ]
    static let merged = [pr(4, "Notch: un solo design, 3 sezioni, notifiche", .merged)]
}
#endif
