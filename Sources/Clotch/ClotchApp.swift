import SwiftUI

struct ClotchApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @ObservedObject private var l10n = L10n.shared

    var body: some Scene {
        Settings {
            EmptyView()
        }
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
