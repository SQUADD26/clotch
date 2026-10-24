import AppKit

extension UserDefaults {
    @objc dynamic var hideWhenNoSession: Bool {
        bool(forKey: SettingsKey.hideWhenNoSession)
    }
}

@MainActor
final class StatusItemController: NSObject, NSMenuDelegate {
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
        // con l'app clotch nel pacchetto il menu è la porta per aprirla (#465): resta visibile anche col notch sempre mostrato
        if SettingsManager.shared.hideWhenNoSession || AppSessioni.url() != nil {
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
        menu.delegate = self

        // figma: 151-70904 — «Apri clotch» / «Mostra clotch» (app già aperta), solo se l'app è dentro il pacchetto (#465)
        if AppSessioni.url() != nil {
            let appItem = NSMenuItem(title: L10n.shared["open_clotch_app"], action: #selector(apriApp), keyEquivalent: "")
            appItem.target = self
            appItem.tag = Self.tagApp
            menu.addItem(appItem)
            menu.addItem(.separator())
        }

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

    private static let tagApp = 465

    func menuNeedsUpdate(_ menu: NSMenu) {
        let aperta = !NSRunningApplication.runningApplications(withBundleIdentifier: "com.squadd.clotch.sessioni").isEmpty
        menu.item(withTag: Self.tagApp)?.title = L10n.shared[aperta ? "show_clotch_app" : "open_clotch_app"]
    }

    @objc private func apriApp() {
        AppSessioni.apri()
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
