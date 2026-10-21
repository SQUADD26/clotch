import AppKit
import SwiftUI
import CodeIslandCore

/// `CodeIsland --snapshot <dir> [--gallery]`: renders the real notch from the live data to PNG (2x)
/// and quits. Without `--gallery`: closed and open (Goals). With it: every Figma state the live data
/// can produce now, named like the Figma frames (01-riposo …); a state the data cannot produce is
/// skipped and said. It is how the notch is checked where screen capture is not allowed. Real data only.
@MainActor
enum GoalSnapshot {
    /// A 14/16" MacBook notch, in points.
    private static let notchWidth: CGFloat = 200
    private static let notchHeight: CGFloat = 32
    private static let openWidth: CGFloat = 600
    /// Stand-in for the menu bar and desktop around the island, so its black shape reads.
    private static let surround = Color(white: 0.24)

    static func requestedDirectory() -> URL? {
        let args = CommandLine.arguments
        guard let i = args.firstIndex(of: "--snapshot"), i + 1 < args.count else { return nil }
        return URL(fileURLWithPath: args[i + 1], isDirectory: true)
    }

    static func run(into dir: URL) {
        let store = GoalStore.shared
        store.loadNow()
        AccountQuotaFeed.shared.loadNow()
        AccountsInUseFeed.shared.start()
        var failed = false
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            func save<V: View>(_ view: V, _ name: String) throws {
                try write(view, to: dir.appendingPathComponent("goal-notch-\(name).png"))
            }
            let closedWidth = notchWidth + GoalsWing.width * 2
            try save(island(width: closedWidth, radius: 12) { EmptyView() }, "01-riposo")
            try save(open(.goals), "05-obiettivi")
            if CommandLine.arguments.contains("--gallery") {
                for (name, event) in notifications() {
                    try save(island(width: 420, radius: NotchSpace.noteRadius) {
                        NotchNotificationView(event: event, phase: .arrive, rows: store.rows, requests: store.requests)
                    }, "02-notifica-\(name)-arriva")
                    try save(island(width: 420, radius: NotchSpace.noteRadius) {
                        NotchNotificationView(event: event, phase: .settle, rows: store.rows, requests: store.requests)
                    }, "03-notifica-\(name)-cambia")
                    try save(island(width: closedWidth, radius: 12, mark: event) { EmptyView() }, "04-notifica-\(name)-sparisce")
                }
                let pages = store.rows.pages
                if pages.count > 1 {
                    // A still of the slide: the next page, dimmed as both pages are while it moves.
                    try save(open(.goals) {
                        GoalPage(row: pages[1], position: 2, of: pages.count, now: store.now).opacity(0.35).blur(radius: 2)
                    }, "06-scorrimento")
                } else {
                    print("snapshot: one goal only, no «scorrimento» frame")
                }
                try save(open(.requests), "07-richieste")
                if store.requests.count > RequestsTab.perPage {
                    try save(open(.requests) {
                        RequestsTab(requests: store.requests, active: store.requestsFolderExists, startPage: 1)
                    }, "15-richieste-pagina2")
                } else {
                    print("snapshot: \(store.requests.count) requests, no second page")
                }
                try save(open(.accounts), "08-account")
                print("snapshot: «PR unita», no-notch centre and account hover come with #6 and #5")
            }
            print("snapshot: \(store.rows.count) goals, \(AccountQuotaFeed.shared.accounts.count) accounts, \(store.requests.count) requests -> \(dir.path)")
        } catch {
            print("snapshot failed: \(error)")
            failed = true
        }
        exit(failed ? 1 : 0)
    }

    /// The notifications today's data can really produce; one that cannot is skipped and said.
    private static func notifications() -> [(String, NotchEvent)] {
        let store = GoalStore.shared
        var out: [(String, NotchEvent)] = []
        if let taken = store.requests.first(where: \.taken) {
            out.append(("richiesta", NotchEvent(kind: .requestTaken, subject: taken.id, count: 0)))
        } else {
            print("snapshot: no request taken in charge yet, no «presa in carico» frames")
        }
        // The goal chased now, as the change its present state would have announced.
        if let hero = store.rows.hero {
            let kind: NotchEvent.Kind?
            switch hero.status {
            case .blocked: kind = .blocked
            case .still: kind = .still
            case .reached: kind = .reached
            case .moving: kind = hero.proofsDone > 0 ? .proofDone : nil
            }
            if let kind {
                out.append(("obiettivo", NotchEvent(kind: kind, subject: hero.id, count: hero.proofsDone)))
            } else {
                print("snapshot: the goal chased now is moving with no proof done, no goal frames")
            }
        }
        return out
    }

    /// The closed island (wings beside the notch) with `below` hanging under it; `mark` stands in for
    /// the notifier's `.leave` step, which the right wing reads from the live notifier.
    private static func island<Below: View>(width: CGFloat, radius: CGFloat, mark: NotchEvent? = nil,
                                            @ViewBuilder below: () -> Below) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                GoalsLeftWing()
                Color.clear.frame(width: notchWidth)  // where the hardware notch sits
                if let mark {
                    ResultMark(event: mark, rows: GoalStore.shared.rows)
                        .padding(.leading, 8)
                        .frame(width: GoalsWing.width, alignment: .leading)
                } else {
                    GoalsRightWing()
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: notchHeight)
            below()
        }
        .frame(width: width)
        .background(UnevenRoundedRectangle(bottomLeadingRadius: radius, bottomTrailingRadius: radius, style: .continuous).fill(.black))
        .padding(.horizontal, 48)
        .padding(.bottom, 24)
        .background(surround)
    }

    /// The open notch on `tab`, as the panel draws it.
    private static func open(_ tab: NotchTab) -> some View {
        let store = GoalStore.shared
        return island(width: openWidth, radius: NotchSpace.radius) {
            NotchSectionsContent(store: store, quota: AccountQuotaFeed.shared, now: store.now, tab: .constant(tab))
        }
    }

    /// The open notch's tab bar with `body` as the tab's content (a second page, a still of a slide).
    private static func open<Body: View>(_ tab: NotchTab, @ViewBuilder body: () -> Body) -> some View {
        island(width: openWidth, radius: NotchSpace.radius) {
            VStack(spacing: NotchSpace.section) {
                TabBar(tab: .constant(tab))
                body().frame(maxWidth: .infinity, alignment: .topLeading)
            }
            .padding(.horizontal, NotchSpace.side)
            .padding(.top, 6)
            .padding(.bottom, 20)
        }
    }

    private static func write<V: View>(_ view: V, to url: URL) throws {
        let renderer = ImageRenderer(content: view.environment(\.colorScheme, .dark))
        renderer.scale = 2
        guard let image = renderer.cgImage else { throw CocoaError(.fileWriteUnknown) }
        guard let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else {
            throw CocoaError(.fileWriteUnknown)
        }
        try data.write(to: url)
    }
}
