import AppKit
import SwiftUI

/// The pages of «Impostazioni di Clotch» (#56), in the toolbar's order: icon and name on top, like the Finder.
enum ClotchSettingsTab: String, CaseIterable {
    case general, notch, notifications, voice, dictation, about

    var title: String {
        switch self {
        case .general: return L10n.shared["general"]
        case .notch: return L10n.shared["notch_page"]
        case .notifications: return L10n.shared["notifications_page"]
        case .voice: return L10n.shared["voice"]
        case .dictation: return L10n.shared["dictation_page"]
        case .about: return L10n.shared["about"]
        }
    }

    var symbol: String {
        switch self {
        case .general: return "gearshape"
        case .notch: return "rectangle.topthird.inset.filled"
        case .notifications: return "bell.badge"
        case .voice: return "waveform"
        case .dictation: return "mic.fill"
        case .about: return "info.circle"
        }
    }

    @MainActor @ViewBuilder var page: some View {
        switch self {
        case .general: ClotchGeneralPage()
        case .notch: ClotchNotchPage()
        case .notifications: ClotchNotificationsPage()
        // The long page: the one that scrolls, at a fixed height.
        case .voice:
            if ClotchSettingsWindow.drawWhole { VoiceSettingsPage() } else {
                ScrollView { VoiceSettingsPage() }.frame(width: ClotchSettingsWindow.width, height: 640)
            }
        case .dictation: DictationPage()
        case .about: ClotchAboutPage()
        }
    }
}

/// The page shown, shared by the toolbar (AppKit) and the content (SwiftUI).
@MainActor final class ClotchSettingsSelection: ObservableObject {
    @Published var tab: ClotchSettingsTab
    init(_ tab: ClotchSettingsTab) { self.tab = tab }
}

private struct ClotchSettingsRoot: View {
    @ObservedObject var selection: ClotchSettingsSelection
    var body: some View { selection.tab.page.id(selection.tab) }
}

/// The window: an AppKit toolbar in the preferences style and one SwiftUI page under it. The hosting
/// view sizes the window to the page, so it changes height with the content.
@MainActor final class ClotchSettingsWindow: NSObject, NSToolbarDelegate {
    static let width: CGFloat = 560
    /// True only for `--snapshot`: the Voce page is drawn whole instead of in its 640 pt scroll view.
    static var drawWhole = false
    let window: NSWindow
    private let selection: ClotchSettingsSelection

    init(tab: ClotchSettingsTab = .general) {
        selection = ClotchSettingsSelection(tab)
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: Self.width, height: 300),
                          styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
        super.init()
        window.contentView = NSHostingView(rootView: ClotchSettingsRoot(selection: selection))
        let toolbar = NSToolbar(identifier: "ClotchSettings")
        toolbar.delegate = self
        toolbar.displayMode = .iconAndLabel
        toolbar.allowsUserCustomization = false
        window.toolbar = toolbar
        window.toolbarStyle = .preference
        window.appearance = AppearanceChoice.read().nsAppearance
        window.isReleasedWhenClosed = false
        select(tab)
    }

    func select(_ tab: ClotchSettingsTab) {
        selection.tab = tab
        window.toolbar?.selectedItemIdentifier = NSToolbarItem.Identifier(tab.rawValue)
        window.title = tab.title
    }

    @objc private func picked(_ item: NSToolbarItem) {
        ClotchSettingsTab(rawValue: item.itemIdentifier.rawValue).map(select)
    }

    private var ids: [NSToolbarItem.Identifier] { ClotchSettingsTab.allCases.map { NSToolbarItem.Identifier($0.rawValue) } }
    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] { ids }
    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] { ids }
    func toolbarSelectableItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] { ids }

    func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier id: NSToolbarItem.Identifier,
                 willBeInsertedIntoToolbar flag: Bool) -> NSToolbarItem? {
        guard let tab = ClotchSettingsTab(rawValue: id.rawValue) else { return nil }
        let item = NSToolbarItem(itemIdentifier: id)
        item.label = tab.title
        item.image = NSImage(systemSymbolName: tab.symbol, accessibilityDescription: tab.title)
        item.target = self
        item.action = #selector(picked(_:))
        return item
    }
}
