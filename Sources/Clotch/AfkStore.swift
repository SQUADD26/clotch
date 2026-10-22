import AppKit
import SwiftUI
import ClotchCore

/// AFK mode (#106): one state, `afk.json`, written only by `voce afk on|off`; the notch, the settings and Clotch's voice read it.
/// `VoiceStore`'s file stream calls `reload()` when an AFK file changes. On return the notch opens with the summary once.
@MainActor
final class AfkStore: ObservableObject {
    static let shared = AfkStore()
    @Published private(set) var isOn = false
    /// Things done since AFK went on: the number beside the moon.
    @Published private(set) var count = 0
    /// The summary on screen; nil = the notch shows its tabs.
    @Published private(set) var report: AfkReport?

    private let files = AfkFiles()
    private var presence = AfkPresence()
    private var watch: Timer?
    private var autoClose: DispatchWorkItem?
    private static let seenKey = "clotchAfkSeen"

    func start() { reload() }

    func reload() {
        let state = files.state
        isOn = state?.attivo == true
        count = isOn ? files.items(since: state?.inizio ?? 0).count : 0
        watchPresence()
        let seen = UserDefaults.standard.double(forKey: Self.seenKey)
        guard !isOn, let summary = files.summary, summary.isNew(seen: seen, now: Date()), let report = files.report else { return }
        UserDefaults.standard.set(summary.t, forKey: Self.seenKey)
        show(report)
    }

    /// The switch in the notch and in the settings: the engine's command is the only writer of the state.
    func set(_ on: Bool) {
        isOn = on  // at once; the file confirms it a moment later
        let voce = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".local/bin/voce").path
        // A Dock-launched app has no Homebrew nor ~/.local/bin in PATH.
        let path = "/opt/homebrew/bin:/usr/local/bin:\(NSHomeDirectory())/.local/bin:" + (ProcessInfo.processInfo.environment["PATH"] ?? "/usr/bin:/bin")
        Task.detached {
            _ = EngineCommand.run("/bin/bash", [voce, "afk", on ? "on" : "off"], env: ["PATH": path])
            await MainActor.run { AfkStore.shared.reload() }
        }
    }

    func dismiss(closing: Bool = true) {
        autoClose?.cancel()
        guard report != nil else { return }
        report = nil
        if closing, let state = Self.appState, state.surface.isExpanded {
            withAnimation(NotchAnimation.close) { state.surface = .collapsed }
        }
    }

    private func show(_ report: AfkReport) {
        self.report = report
        if let state = Self.appState {
            withAnimation(NotchAnimation.open) { state.surface = .sessionList }
        }
        if UserDefaults.standard.object(forKey: ClotchPrefs.afkReadAloud) as? Bool ?? ClotchPrefs.afkReadAloudDefault {
            Task { await VoiceSpeaker.shared.sayAloud(report.sentence) }
        }
        autoClose?.cancel()
        guard report.groups.isEmpty else { return }
        let item = DispatchWorkItem { MainActor.assumeIsolated { AfkStore.shared.dismiss() } }
        autoClose = item
        DispatchQueue.main.asyncAfter(deadline: .now() + 4, execute: item)
    }

    /// «Spegni AFK quando torni al Mac»: while AFK is on, the seconds since the last input, every 5 s.
    private func watchPresence() {
        let wanted = isOn && (UserDefaults.standard.object(forKey: ClotchPrefs.afkEndOnReturn) as? Bool ?? ClotchPrefs.afkEndOnReturnDefault)
        guard wanted != (watch != nil) else { return }
        watch?.invalidate()
        watch = nil
        presence = AfkPresence()
        guard wanted else { return }
        watch = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { _ in
            MainActor.assumeIsolated {
                let store = AfkStore.shared
                let idle = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: CGEventType(rawValue: ~0)!)
                if store.presence.back(idle: idle) { store.set(false) }
            }
        }
    }

    private static var appState: AppState? { (NSApp.delegate as? AppDelegate)?.appState }
}
