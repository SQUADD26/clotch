import SwiftUI

struct ClotchApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @ObservedObject private var l10n = L10n.shared

    var body: some Scene {
        // A scene with no window, only to hold the menus: a `Settings {}` scene opened its own empty
        // «Clotch Settings» window beside the real one (#82).
        MenuBarExtra("Clotch", isInserted: .constant(false)) { EmptyView() }
        .commands {
            CommandGroup(replacing: .appSettings) {
                Button(l10n["settings"] + "…") { SettingsWindowController.shared.show() }
                    .keyboardShortcut(",")
            }
            CommandGroup(replacing: .appTermination) {
                Button(l10n["quit"]) { NSApp.terminate(nil) }
                    .keyboardShortcut("q")
            }
        }
    }
}
