import AppKit
import SwiftUI

/// `CodeIsland --snapshot <dir> [--gallery]`: renders the real goal views from the live register
/// to PNG (2x) and quits. It is how the notch is checked where screen capture is not allowed.
/// Real data only. `--gallery` renders every design direction, plus the open list with its first
/// row hovered; without it, only the current direction.
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
        let gallery = CommandLine.arguments.contains("--gallery")
        var failed = false
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            for design in gallery ? GoalDesign.allCases : [GoalDesign.current] {
                let name = gallery ? "goal-notch-\(design.rawValue)-" : "goal-notch-"
                try write(collapsed(design), to: dir.appendingPathComponent(name + "collapsed.png"))
                try write(expanded(design, hovered: nil), to: dir.appendingPathComponent(name + "expanded.png"))
                if gallery, let first = store.rows.first {
                    try write(expanded(design, hovered: first.id), to: dir.appendingPathComponent(name + "expanded-hover.png"))
                }
            }
            print("snapshot: \(store.rows.count) goals -> \(dir.path)")
        } catch {
            print("snapshot failed: \(error)")
            failed = true
        }
        exit(failed ? 1 : 0)
    }

    private static func collapsed(_ design: GoalDesign) -> some View {
        HStack(spacing: 0) {
            GoalsLeftWing(expanded: false, design: design)
            Color.clear.frame(width: notchWidth)  // where the hardware notch sits
            GoalsRightWing(expanded: false, design: design)
        }
        .frame(height: notchHeight)
        .background(UnevenRoundedRectangle(bottomLeadingRadius: 12, bottomTrailingRadius: 12, style: .continuous).fill(.black))
        .padding(.horizontal, 48)
        .padding(.bottom, 12)
        .background(surround)
    }

    private static func expanded(_ design: GoalDesign, hovered: String?) -> some View {
        let store = GoalStore.shared
        return VStack(spacing: 0) {
            HStack {
                GoalsLeftWing(expanded: true, design: design)
                Spacer()
                GoalsRightWing(expanded: true, design: design)
            }
            .frame(height: notchHeight)
            if store.rows.isEmpty {
                GoalsEmptyState()
            } else {
                // The rows without the scroll view: ImageRenderer does not draw ScrollView content.
                design.rows(store.rows, now: store.now, hovered: .constant(hovered))
            }
        }
        .frame(width: 580)
        .background(UnevenRoundedRectangle(bottomLeadingRadius: 24, bottomTrailingRadius: 24, style: .continuous).fill(.black))
        .padding(.horizontal, 24)
        .padding(.bottom, 24)
        .background(surround)
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
