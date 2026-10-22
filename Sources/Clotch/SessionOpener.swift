import AppKit
import SwiftUI
import ClotchCore

/// The one click for every notch row that belongs to a Claude session (a goal's title, a request taken in charge).
@MainActor enum SessionOpener {
    /// Opens `target` in the copy of the Claude app that owns it. `claude://` is registered by every copy, so a plain
    /// open lands in whichever the system prefers and shows nothing of another account's session: the link goes to the
    /// copy whose launcher fixes the session's data folder. No copy matches (the plain Claude.app has no launcher): the default app.
    static func open(_ target: SessionTarget) {
        guard let url = target.url else { return }
        NotchExit.close()
        launch(url, appCopy(owning: target.profile))
    }

    /// The tests swap it: a test never opens the Claude app in front of Roberto.
    static var launch: (URL, URL?) -> Void = { url, app in
        guard let app else {
            NSWorkspace.shared.open(url)
            return
        }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = true
        NSWorkspace.shared.open([url], withApplicationAt: app, configuration: configuration)
    }

    /// `Claude <email>.app` in ~/Applications or /Applications whose launcher names `profile` as its data folder.
    static func appCopy(owning profile: String) -> URL? {
        guard !profile.isEmpty else { return nil }
        let home = NSHomeDirectory()
        for root in [home + "/Applications", "/Applications"] {
            let names = (try? FileManager.default.contentsOfDirectory(atPath: root)) ?? []
            for name in names.sorted() where name.hasPrefix("Claude ") && name.hasSuffix(".app") {
                let app = root + "/" + name
                guard let launcher = try? String(contentsOfFile: app + "/Contents/MacOS/launcher", encoding: .utf8),
                      SessionTarget.dataDir(launcher: launcher, home: home) == profile else { continue }
                return URL(fileURLWithPath: app)
            }
        }
        return nil
    }
}

/// Every click in the notch that leads outside it (the gear, a session, a link) closes it, whatever the setting for the
/// pointer leaving says: that setting is about the pointer, not about a click that already took Roberto elsewhere (#126).
/// An approval or a question stays up: it waits for an answer, as the click outside the notch also leaves it.
enum NotchExit {
    @MainActor static func close() {
        guard let appState = SettingsWindowController.shared.appState else { return }
        switch appState.surface {
        case .collapsed, .approvalCard, .questionCard: return
        default: break
        }
        withAnimation(NotchAnimation.close) {
            appState.surface = .collapsed
            appState.cancelCompletionQueue()
        }
    }
}

extension View {
    /// A row that opens `target` on click: the shared hover (hand cursor) and tap. No target (or an id the app would refuse): the row stays as it is.
    @ViewBuilder func opensSession(_ target: SessionTarget?) -> some View {
        if let target, target.url != nil {
            contentShape(Rectangle()).onTapGesture { SessionOpener.open(target) }.notchHover()
        } else {
            self
        }
    }
}
