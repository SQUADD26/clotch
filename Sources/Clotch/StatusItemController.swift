import AppKit

extension UserDefaults {
    @objc dynamic var hideWhenNoSession: Bool {
        bool(forKey: SettingsKey.hideWhenNoSession)
    }
}

@MainActor
final class StatusItemController: NSObject {
    static let shared = StatusItemController()

    private var statusItem: NSStatusItem?
    private var observation: NSKeyValueObservation?
    private lazy var menu: NSMenu = makeMenu()

    func startObserving() {
        syncVisibility()
        observation = UserDefaults.standard.observe(
            \.hideWhenNoSession, options: [.new]
        ) { [weak self] _, _ in
            Task { @MainActor in self?.syncVisibility() }
        }
    }

    private func syncVisibility() {
        if SettingsManager.shared.hideWhenNoSession {
            showStatusItem()
        } else {
            hideStatusItem()
        }
    }

    private func showStatusItem() {
        if statusItem == nil {
            let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
            if let button = item.button {
                button.image = Self.menuBarIcon()
                button.imageScaling = .scaleProportionallyDown
                button.toolTip = "Clotch"
            }
            item.menu = menu
            statusItem = item
        }
    }

    /// Menu-bar art is a *template* image by macOS convention (#313): alpha-only
    /// artwork that AppKit tints itself, so it tracks light/dark, the menu bar's
    /// own tint over a wallpaper, and the pressed/highlighted state.
    ///
    /// The mark is the Clotch logo's omino (`AppLogoView.omino`, #58) with its eyes
    /// knocked out: the same grid as the app icon, at 1.25pt a pixel.
    static func menuBarIcon() -> NSImage {
        let px: CGFloat = 1.25
        let image = NSImage(size: NSSize(width: 18, height: 18), flipped: true) { _ in
            NSColor.black.setFill()
            for (row, line) in AppLogoView.omino.enumerated() {
                for (col, cell) in line.enumerated() where cell == "B" || cell == "F" {
                    NSRect(x: 0.25 + CGFloat(col) * px, y: 3.375 + CGFloat(row) * px, width: px, height: px).fill()
                }
            }
            return true
        }
        image.isTemplate = true
        return image
    }

    private func hideStatusItem() {
        guard let statusItem else { return }
        NSStatusBar.system.removeStatusItem(statusItem)
        self.statusItem = nil
    }

    private func makeMenu() -> NSMenu {
        let menu = NSMenu()

        let settingsItem = NSMenuItem(
            title: L10n.shared["settings_ellipsis"],
            action: #selector(openSettings),
            keyEquivalent: ""
        )
        settingsItem.target = self
        menu.addItem(settingsItem)

        menu.addItem(.separator())

        let quitItem = NSMenuItem(
            title: L10n.shared["quit"],
            action: #selector(quitApp),
            keyEquivalent: ""
        )
        quitItem.target = self
        menu.addItem(quitItem)

        return menu
    }

    @objc private func openSettings() {
        Task { @MainActor in
            SettingsWindowController.shared.show()
        }
    }

    @objc private func quitApp() {
        NSApp.terminate(nil)
    }
}
