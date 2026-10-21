import AppKit
import SwiftUI

@MainActor
class SettingsWindowController {
    static let shared = SettingsWindowController()
    private var window: NSWindow?
    private var settings: ClotchSettingsWindow?
    weak var appState: AppState?

    private var closeObserver: NSObjectProtocol?

    /// How the window comes up. The tests swap it for a transparent window with no Dock icon (#82).
    var present: @MainActor (NSWindow) -> Void = { window in
        // Switch to regular activation policy so the window can receive focus
        NSApp.setActivationPolicy(.regular)
        // Use the actual bundle app icon so Dock matches the packaged asset catalog icon.
        NSApp.applicationIconImage = SettingsWindowController.bundleAppIcon()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func clearCloseObserver() {
        if let closeObserver {
            NotificationCenter.default.removeObserver(closeObserver)
            self.closeObserver = nil
        }
    }

    func show() {
        if let window = window {
            present(window)
            return
        }

        // Finder-style window (#56): toolbar with one item per page, height follows the page.
        let settings = ClotchSettingsWindow()
        self.settings = settings  // the toolbar's delegate: NSToolbar holds it weakly
        let window = settings.window
        window.center()
        window.isReleasedWhenClosed = false
        present(window)

        clearCloseObserver()
        closeObserver = NotificationCenter.default.addObserver(
            forName: NSWindow.willCloseNotification, object: window, queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                NSApp.setActivationPolicy(.accessory)  // window closed: back to background, no Dock icon (#70)
                self?.window = nil
                self?.settings = nil
                self?.clearCloseObserver()
            }
        }

        self.window = window
    }

    func applyAppearance() {
        window?.appearance = AppearanceChoice.read().nsAppearance
    }

    static func bundleAppIcon() -> NSImage {
        let image = NSWorkspace.shared.icon(forFile: Bundle.main.bundlePath)
        image.size = NSSize(width: 256, height: 256)
        return image
    }
}
