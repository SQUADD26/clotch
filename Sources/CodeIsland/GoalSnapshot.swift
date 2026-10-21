import AppKit
import SwiftUI

/// `CodeIsland --snapshot <dir>`: renders the real goal views from the live register to PNG and quits.
/// It is how the notch is checked where screen capture is not allowed. Real data only.
@MainActor
enum GoalSnapshot {
    static func requestedDirectory() -> URL? {
        let args = CommandLine.arguments
        guard let i = args.firstIndex(of: "--snapshot"), i + 1 < args.count else { return nil }
        return URL(fileURLWithPath: args[i + 1], isDirectory: true)
    }

    static func run(into dir: URL) {
        let store = GoalStore.shared
        store.loadNow()
        let width: CGFloat = 580
        let expanded = VStack(spacing: 0) {
            HStack {
                GoalsLeftWing(expanded: true)
                Spacer()
            }
            .frame(height: 32)
            if store.rows.isEmpty {
                GoalsEmptyState()
            } else {
                GoalRowsList(rows: store.rows, now: store.now)
            }
        }
        let collapsed = HStack(spacing: 0) {
            GoalsLeftWing(expanded: false)
            Spacer(minLength: 200)  // where the hardware notch sits
            GoalsRightWing(expanded: false)
        }
        .frame(height: 32)

        var failed = false
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try write(expanded.frame(width: width), to: dir.appendingPathComponent("goal-notch-expanded.png"))
            try write(collapsed.frame(width: 320), to: dir.appendingPathComponent("goal-notch-collapsed.png"))
            print("snapshot: \(store.rows.count) goals -> \(dir.path)")
        } catch {
            print("snapshot failed: \(error)")
            failed = true
        }
        exit(failed ? 1 : 0)
    }

    private static func write<V: View>(_ view: V, to url: URL) throws {
        let renderer = ImageRenderer(content: view.background(Color.black).environment(\.colorScheme, .dark))
        renderer.scale = 2
        guard let image = renderer.cgImage else { throw CocoaError(.fileWriteUnknown) }
        guard let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else {
            throw CocoaError(.fileWriteUnknown)
        }
        try data.write(to: url)
    }
}
