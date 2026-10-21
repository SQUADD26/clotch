import AppKit
import SwiftUI
import ClotchCore

/// The one click for every notch row that belongs to a Claude session (a goal's title, a request taken in charge).
enum SessionOpener {
    /// Opens `target` in the copy of the Claude app that owns it. `claude://` is registered by every copy, so a plain
    /// open lands in whichever the system prefers and shows nothing of another account's session: the link goes to the
    /// copy whose launcher fixes the session's data folder. No copy matches (the plain Claude.app has no launcher): the default app.
    static func open(_ target: SessionTarget) {
        guard let url = target.url else { return }
        SessionSeen.shared.markOpened(target.localId)
        guard let app = appCopy(owning: target.profile) else {
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
