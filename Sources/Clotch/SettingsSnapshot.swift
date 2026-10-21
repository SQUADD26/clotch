import AppKit
import SwiftUI

/// `--snapshot <dir> --gallery` also draws «Impostazioni di Clotch» (#56, #95): one PNG per page, dark and light, plus the
/// «Personalizza il notch» sheet. The real window with its toolbar, drawn while invisible: ImageRenderer cannot draw
/// AppKit controls, so the window draws itself.
@MainActor
enum SettingsSnapshot {
    static func save(into dir: URL) throws {
        ClotchSettingsWindow.drawWhole = true
        defer { ClotchSettingsWindow.drawWhole = false }
        for (look, appearance) in [("scuro", NSAppearance.Name.darkAqua), ("chiaro", .aqua)] {
            for (i, tab) in ClotchSettingsTab.allCases.enumerated() {
                let window = ClotchSettingsWindow(tab: tab).window
                try draw(window, appearance, to: dir.appendingPathComponent("clotch-10-impostazioni-\(i + 1)-\(tab.rawValue)-\(look).png"))
            }
            let sheet = NSWindow(contentRect: .zero, styleMask: [.titled], backing: .buffered, defer: false)
            sheet.contentView = NSHostingView(rootView: NotchCustomizeView(onDone: {}))
            try draw(sheet, appearance, to: dir.appendingPathComponent("clotch-10-impostazioni-6-personalizza-\(look).png"))
        }
    }

    private static func draw(_ window: NSWindow, _ appearance: NSAppearance.Name, to url: URL) throws {
        window.appearance = NSAppearance(named: appearance)
        window.alphaValue = 0  // drawn for the file, never seen on screen
        window.orderFrontRegardless()
        RunLoop.main.run(until: Date().addingTimeInterval(0.5))  // the hosting view sizes the window to the page
        guard let frame = window.contentView?.superview,  // title bar and toolbar included
              let rep = frame.bitmapImageRepForCachingDisplay(in: frame.bounds) else { throw CocoaError(.fileWriteUnknown) }
        frame.cacheDisplay(in: frame.bounds, to: rep)
        window.close()
        guard let png = rep.representation(using: .png, properties: [:]) else { throw CocoaError(.fileWriteUnknown) }
        try png.write(to: url)
    }
}
