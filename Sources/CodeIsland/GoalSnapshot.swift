import AppKit
import SwiftUI
import CodeIslandCore

/// `CodeIsland --snapshot <dir> [--gallery]`: renders the real notch from the live data to PNG (2x)
/// and quits: closed at rest, the open panel, and with `--gallery` the three frames of each
/// notification the live data can produce now (a request taken in charge, a proof of the goal chased
/// now). It is how the notch is checked where screen capture is not allowed. Real data only.
/// ImageRenderer cannot sample a backdrop, so plates draw their stand-in: the real Liquid Glass
/// shows only in the running app.
@MainActor
enum GoalSnapshot {
    /// A 14/16" MacBook notch, in points.
    private static let notchWidth: CGFloat = 200
    private static let notchHeight: CGFloat = 32
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
        var failed = false
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            func save<V: View>(_ view: V, _ name: String) throws {
                try write(view, to: dir.appendingPathComponent("goal-notch-\(name).png"))
            }
            try save(island(width: notchWidth + GoalsWing.width * 2, radius: 12) { EmptyView() }, "collapsed")
            try save(expanded(), "expanded")
            if CommandLine.arguments.contains("--gallery") {
                for (name, event) in notifications() {
                    for phase in NotePhase.allCases {
                        try save(island(width: 420, radius: 24) {
                            NotchNotificationView(event: event, phase: phase, rows: store.rows, requests: store.requests)
                        }, "notifica-\(name)-\(phase.rawValue + 1)")
                    }
                }
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

    /// The closed island (wings beside the notch) with `below` hanging under it.
    private static func island<Below: View>(width: CGFloat, radius: CGFloat, @ViewBuilder below: () -> Below) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                GoalsLeftWing()
                Color.clear.frame(width: notchWidth)  // where the hardware notch sits
                GoalsRightWing()
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

    private static func expanded() -> some View {
        let store = GoalStore.shared
        return VStack(spacing: 0) {
            HStack(spacing: 0) {
                GoalsLeftWing()
                Color.clear.frame(width: notchWidth)
                GoalsRightWing()
            }
            .frame(height: notchHeight)
            NotchSectionsContent(store: store, quota: AccountQuotaFeed.shared)
        }
        .frame(width: 580)
        .background(UnevenRoundedRectangle(bottomLeadingRadius: 24, bottomTrailingRadius: 24, style: .continuous).fill(.black))
        .padding(.horizontal, 24)
        .padding(.bottom, 24)
        .background(surround)
    }

    private static func write<V: View>(_ view: V, to url: URL) throws {
        let renderer = ImageRenderer(content: view.environment(\.colorScheme, .dark).environment(\.notchSnapshot, true))
        renderer.scale = 2
        guard let image = renderer.cgImage else { throw CocoaError(.fileWriteUnknown) }
        guard let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else {
            throw CocoaError(.fileWriteUnknown)
        }
        try data.write(to: url)
    }
}
