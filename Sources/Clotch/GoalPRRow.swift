import SwiftUI
import ClotchCore

// The pull requests under a goal (Figma A3, approved): open ones only, one line each: icon, number, title,
// state. A PR just merged shows once: one pass of light across its line, then it stays a while, its text fades left to right and the line leaves (#86, #100, `PRMergeMotion`).

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

/// One PR line. A merged one is quieter (done) and lights up as `shine` runs from 0 to 1.
struct GoalPRRow: View {
    let info: PRInfo
    var shine: CGFloat = 0

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
                .foregroundStyle(info.state == .merged ? GoalInk.secondary : GoalInk.primary)
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
        .modifier(Shine(progress: shine, tint: look.color))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Pull request \(info.ref.number), \(info.title), \(look.label)")
    }
}

/// A pass of light across a line, drawn only through its own text and symbols, like the Lock screen's
/// «slide to unlock»: white at the centre, the state's tint at the edges, nothing at 0 and 1.
private struct Shine: ViewModifier, Animatable {
    var progress: CGFloat
    let tint: Color
    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func body(content: Content) -> some View {
        // Always there, so no insertion fades it in mid-pass; at 0 and 1 the band lies outside the mask.
        content.overlay {
            GeometryReader { g in
                let band = max(g.size.width * 0.4, 1)
                LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: tint.opacity(0.6), location: 0.3),
                                       .init(color: .white, location: 0.5), .init(color: tint.opacity(0.6), location: 0.7),
                                       .init(color: .clear, location: 1)],
                               startPoint: .leading, endPoint: .trailing)
                    .frame(width: band)
                    .offset(x: -band + (g.size.width + band) * progress)
            }
            .mask(content)
            .allowsHitTesting(false)
        }
    }
}

/// A line of the list. A merged one plays its moment (`PRMergeMotion`), then asks to leave.
private struct PRLine: View {
    let info: PRInfo
    let onShown: () -> Void
    @State private var shine: CGFloat = 0
    @State private var wipe: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GoalPRRow(info: info, shine: shine)
            .modifier(RowWipe(progress: wipe))
            .task(id: info.state == .merged ? info.ref : nil) {
                guard info.state == .merged else { return }
                // Cancelled when the notch closes: the event waits for the next opening.
                do {
                    try await Task.sleep(for: .seconds(PRMergeMotion.delay))
                    if !reduceMotion {
                        withAnimation(.timingCurve(0.45, 0, 0.25, 1, duration: PRMergeMotion.shimmer)) { shine = 1 }
                    }
                    try await Task.sleep(for: .seconds(PRMergeMotion.stay(reduceMotion: reduceMotion) - PRMergeMotion.delay))
                    // The text goes left to right in place, then the row closes and the others rise.
                    if !reduceMotion {
                        withAnimation(.easeInOut(duration: PRMergeMotion.wipe)) { wipe = 1 }
                        try await Task.sleep(for: .seconds(PRMergeMotion.wipe))
                    }
                } catch { wipe = 0; return }  // notch closed mid-exit: the row shows whole next time
                withAnimation(NotchMotion.animation(reduce: reduceMotion)) { onShown() }
            }
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

    var body: some View {
        let motion = NotchMotion.animation(reduce: reduceMotion)  // one spring; Reduce Motion: a short fade
        let rows = open.sorted { $0.ref.number > $1.ref.number } + merged
        VStack(alignment: .leading, spacing: 0) {
            if !rows.isEmpty {
                Rectangle().fill(GoalInk.divider).frame(height: 0.5)  // the rule under the goal's summary (Figma A3)
                    .padding(.horizontal, NotchSpace.row).padding(.bottom, NotchSpace.row)
                Label("Pull request", systemImage: "arrow.triangle.branch")
                    .font(NotchType.label)
                    .foregroundStyle(GoalInk.secondary)
                    .padding(.horizontal, NotchSpace.row).padding(.bottom, NotchSpace.tight)
                ForEach(rows, id: \.ref) { info in
                    PRLine(info: info) { onMergedShown(info.ref) }
                        .transition(.notchRow(reduce: reduceMotion))
                }
            }
        }
        .padding(.horizontal, -NotchSpace.row)  // undoes the rows' own inset: the text sits on the column
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
        PRInfo(ref: PRRef(repo: "SQUADD26/clotch", number: n), title: title, url: "https://github.com/SQUADD26/clotch/pull/\(n)", state: state)
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
