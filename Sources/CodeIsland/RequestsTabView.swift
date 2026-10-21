import SwiftUI
import CodeIslandCore

/// The «Richieste» tab of the open notch: Roberto's requests, newest first, 5 a page. Draws no
/// background (the notch is black) and no outer padding: the shell insets it.
/// Plug in: `RequestsTabView(requests: store.requests, active: store.requestsFolderExists, fresh: Set(store.takenToAnimate))`.
struct RequestsTabView: View {
    static let pageSize = 5
    static let rowHeight: CGFloat = 32

    let requests: [UserRequest]
    /// False until the requests register exists on this Mac.
    let active: Bool
    /// Ids taken in charge while nobody looked (`GoalStore.takenToAnimate`): their strike is drawn when seen.
    var fresh: Set<String> = []
    @State private var pageID: Int?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.notchSnapshot) private var snapshot

    init(requests: [UserRequest], active: Bool, fresh: Set<String> = [], page: Int = 0) {
        self.requests = requests
        self.active = active
        self.fresh = fresh
        _pageID = State(initialValue: page)
    }

    private var pages: [[UserRequest]] {
        stride(from: 0, to: requests.count, by: Self.pageSize).map { Array(requests[$0..<min($0 + Self.pageSize, requests.count)]) }
    }
    private var page: Int { min(pageID ?? 0, max(pages.count - 1, 0)) }

    var body: some View {
        VStack(alignment: .leading, spacing: NotchSpace.head) {
            if requests.isEmpty {
                empty
            } else {
                header
                paged
                if pages.count > 1 { footer }
            }
        }
        .onChange(of: pages.count) { _, count in if (pageID ?? 0) >= count { pageID = max(count - 1, 0) } }
    }

    // MARK: Parts

    private var header: some View {
        let taken = requests.filter(\.taken).count
        return HStack {
            Label("Richieste", systemImage: "tray").labelStyle(.titleAndIcon)
            Spacer(minLength: NotchSpace.row)
            Text("\(requests.count) in tutto · \(taken) \(taken == 1 ? "presa" : "prese") in carico")
        }
        .font(NotchType.secondary)
        .foregroundStyle(GoalInk.secondary)
    }

    private var empty: some View {
        VStack(alignment: .leading, spacing: NotchSpace.tight) {
            Text("Nessuna richiesta").font(NotchType.bodyEmphasis).foregroundStyle(GoalInk.secondary)
            Text(active ? "Compaiono qui appena le scrivi." : "Arrivano con il prossimo aggiornamento.")
                .font(NotchType.secondary).foregroundStyle(GoalInk.secondary)
        }
    }

    @ViewBuilder private var paged: some View {
        let all = pages
        if snapshot {
            // ImageRenderer skips ScrollView content: draw the current page alone.
            pageView(all[page], index: page).frame(height: Self.rowHeight * CGFloat(Self.pageSize), alignment: .top)
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 0) {
                    ForEach(all.indices, id: \.self) { i in
                        pageView(all[i], index: i).containerRelativeFrame(.horizontal).id(i)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollPosition(id: $pageID)
            .scrollTargetBehavior(OneStepPaging())
            .frame(height: Self.rowHeight * CGFloat(Self.pageSize), alignment: .top)
        }
    }

    private func pageView(_ rows: [UserRequest], index: Int) -> some View {
        VStack(spacing: 0) {
            ForEach(rows) { RequestRow(request: $0, visible: index == page, fresh: fresh.contains($0.id)) }
            Spacer(minLength: 0)
        }
    }

    private var footer: some View {
        let last = page == pages.count - 1
        return VStack(spacing: NotchSpace.head) {
            Rectangle().fill(GoalInk.track).frame(height: 1)
            HStack {
                Button { go(last ? 0 : page + 1) } label: {
                    HStack(spacing: NotchSpace.tight) {
                        if last { Image(systemName: "chevron.left") }
                        Text(Self.moreLabel(page: page, total: requests.count))
                        if !last { Image(systemName: "chevron.right") }
                    }
                    .font(NotchType.bodyEmphasis).foregroundStyle(GoalInk.primary)
                }
                .buttonStyle(.plain)
                Spacer()
                Text("\(page + 1) di \(pages.count)").font(NotchType.secondary).foregroundStyle(GoalInk.secondary)
            }
            .overlay { pager }
        }
    }

    private var pager: some View {
        HStack(spacing: NotchSpace.row) {
            step("chevron.left", to: page - 1, help: "Mostra pagina precedente")
            HStack(spacing: NotchSpace.tight) {
                ForEach(pages.indices, id: \.self) { i in
                    Capsule().fill(i == page ? GoalInk.primary : GoalInk.track)
                        .frame(width: i == page ? 14 : 8, height: 4)
                }
            }
            step("chevron.right", to: page + 1, help: "Mostra pagina successiva")
        }
    }

    private func step(_ symbol: String, to target: Int, help: String) -> some View {
        let enabled = pages.indices.contains(target)
        return Button { go(target) } label: {
            Image(systemName: symbol).font(.system(size: 10, weight: .bold))
                .foregroundStyle(enabled ? GoalInk.primary : GoalInk.secondary.opacity(0.5))
                .frame(width: 24, height: 24)
                .background(Circle().fill(Color.white.opacity(enabled ? 0.16 : 0.07)))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .help(help)
        .accessibilityLabel(help)
    }

    private func go(_ target: Int) {
        withAnimation(reduceMotion ? nil : NotchAnimation.close) { pageID = target }
    }

    /// «Altre N» while pages follow (N = requests after this page); «Prime 5» on the last page.
    static func moreLabel(page: Int, total: Int) -> String {
        (page + 1) * pageSize < total ? "Altre \(total - (page + 1) * pageSize)" : "Prime \(pageSize)"
    }
}

/// One page per gesture, however hard the scroll: the target never leaves the page the gesture started on ±1.
private struct OneStepPaging: ScrollTargetBehavior {
    func updateTarget(_ target: inout ScrollTarget, context: TargetContext) {
        let width = context.containerSize.width
        guard width > 0 else { return }
        let start = Int((context.originalTarget.rect.minX / width).rounded())
        let wanted = Int((target.rect.minX / width).rounded())
        target.rect.origin.x = CGFloat(min(max(wanted, start - 1), start + 1)) * width
    }
}

// MARK: - Row

/// Which ids already had their strike drawn this run, and which were seen waiting: a strike is drawn
/// with the animation only for a request seen waiting (or flagged `fresh`) and not drawn yet. At launch
/// everything already taken is just struck, like GoalStore's baseline.
@MainActor private enum StrikeMemory {
    static var waiting: Set<String> = []
    static var drawn: Set<String> = []
}

private struct RequestRow: View {
    let request: UserRequest
    let visible: Bool
    @State private var struck: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @MainActor init(request: UserRequest, visible: Bool, fresh: Bool) {
        self.request = request
        self.visible = visible
        let toAnimate = StrikeMemory.waiting.contains(request.id) || fresh
        _struck = State(initialValue: request.taken && (StrikeMemory.drawn.contains(request.id) || !toAnimate))
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: struck ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 16))
                .foregroundStyle(struck ? GoalTone.go.color : GoalInk.secondary)
                .contentTransition(.symbolEffect(.replace))
                .frame(width: 18)
            Text(request.text)
                .font(NotchType.body)
                .lineLimit(1)
                .foregroundStyle(struck ? GoalInk.secondary : GoalInk.primary)
                .overlay(alignment: .leading) {
                    Rectangle().fill(GoalInk.secondary).frame(height: 1)
                        .scaleEffect(x: struck ? 1 : 0, anchor: .leading)
                }
            Spacer(minLength: NotchSpace.row)
            Text(label).font(NotchType.caption).foregroundStyle(struck ? GoalTone.go.color : GoalInk.secondary)
        }
        .frame(height: RequestsTabView.rowHeight)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(request.text). \(label)")
        .onAppear {
            if !request.taken { StrikeMemory.waiting.insert(request.id) }
            settle()
        }
        .onChange(of: request.taken) { _, taken in
            if taken { settle() } else { struck = false }
        }
        .onChange(of: visible) { _, _ in settle() }
    }

    private var label: String {
        !struck ? "In attesa" : request.state == "fatta" ? "Fatta" : "Presa in carico"
    }

    /// Draws the strike the first time a taken request is on screen.
    @MainActor private func settle() {
        guard request.taken, visible, !struck else { return }
        StrikeMemory.drawn.insert(request.id)
        withAnimation(reduceMotion ? nil : NotchAnimation.close) { struck = true }
    }
}
