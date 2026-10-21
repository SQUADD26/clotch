import AppKit

/// `--snapshot <dir> --gallery` also draws «Impostazioni di Clotch» (#56): one PNG per page, the real window
/// with its toolbar, drawn while invisible. ImageRenderer cannot draw AppKit controls, so the window draws itself.
@MainActor
enum SettingsSnapshot {
    static func save(into dir: URL) throws {
        for (i, tab) in ClotchSettingsTab.allCases.enumerated() {
            let settings = ClotchSettingsWindow(tab: tab)
            let window = settings.window
            window.alphaValue = 0  // drawn for the file, never seen on screen
            window.orderFrontRegardless()
            RunLoop.main.run(until: Date().addingTimeInterval(0.5))  // the hosting view sizes the window to the page
            guard let frame = window.contentView?.superview,  // title bar and toolbar included
                  let rep = frame.bitmapImageRepForCachingDisplay(in: frame.bounds) else { throw CocoaError(.fileWriteUnknown) }
            frame.cacheDisplay(in: frame.bounds, to: rep)
            window.close()
            guard let png = rep.representation(using: .png, properties: [:]) else { throw CocoaError(.fileWriteUnknown) }
            try png.write(to: dir.appendingPathComponent("goal-notch-10-impostazioni-\(i + 1)-\(tab.rawValue).png"))
        }
    }
}
