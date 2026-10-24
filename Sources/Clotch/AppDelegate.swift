import AppKit
import SwiftUI
import os.log
import ClotchCore

@MainActor
class AppDelegate: NSObject, NSApplicationDelegate {
    nonisolated private static let log = Logger(subsystem: ClotchLog.subsystem, category: "AppDelegate")

    var panelController: PanelWindowController?
    let hotKeyManager = GlobalHotKeyManager()
    private var localShortcutMonitor: Any?
    let appState = AppState()

    func applicationDidFinishLaunching(_ notification: Notification) {
        if let dir = GoalSnapshot.requestedDirectory() {
            GoalSnapshot.run(into: dir)
        }
        Self.log.notice("launch: build \(Bundle.main.object(forInfoDictionaryKey: "ClotchCommit") as? String ?? "unknown", privacy: .public) at \(Bundle.main.bundlePath, privacy: .public)")
        SingleInstance.replaceOthers()
        ProcessInfo.processInfo.disableAutomaticTermination("Clotch must stay running")
        ProcessInfo.processInfo.disableSuddenTermination()
        // Pre-set app icon so Dock/menu bar use the packaged bundle icon.
        NSApp.applicationIconImage = SettingsWindowController.bundleAppIcon()
        SettingsWindowController.shared.appState = appState
        StatusItemController.shared.startObserving()
        panelController = PanelWindowController(appState: appState)
        panelController?.showPanel()
        GoalStore.shared.start()
        NotchNotifier.shared.start()
        AccountQuotaFeed.shared.start()
        AccountsInUseFeed.shared.start()
        VoiceStore.shared.start()
        VoiceSpeaker.shared.start()
        VoiceInputController.shared.prewarm()
        AfkStore.shared.start()
        MacBridge.shared.start()
        MacPermissionsAsker.askOnceWhenFree()

        #if DEBUG
        // Preview mode: inject mock data if --preview flag is present
        if let scenario = DebugHarness.requestedScenario() {
            Self.log.debug("Loading scenario: \(scenario.rawValue)")
            DebugHarness.apply(scenario, to: appState)
            // --collapsed keeps the bar collapsed, for checking the compact layout.
            if DebugHarness.keepsCollapsed { return }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 300_000_000)
                if appState.surface == .collapsed {
                    withAnimation(NotchAnimation.pop) {
                        appState.surface = .sessionList
                    }
                }
            }
            return
        }
        #endif

        // #117: no boot expand; the notch opens only for Roberto.
        setupGlobalShortcut()
        // #239: the same press as ⌥V from a local command, with no Accessibility asked of the sender (distributed
        // notifications stay inside this login session): live tests open and close the dictation this way.
        // #247: live test of the outgoing voice (ElevenLabs, Roberto's settings, Italian): says «Prova voce», no text on screen.
        DistributedNotificationCenter.default().addObserver(forName: Notification.Name("com.squadd.clotch.prova-voce"), object: nil, queue: .main) { _ in
            Task { _ = await VoiceSpeaker.shared.test() }
        }
        for (name, run) in [("voci-italiane", VoiceDiagnostics.listItalianVoices), ("verifica-voce", VoiceDiagnostics.verifyLanguage)] {
            DistributedNotificationCenter.default().addObserver(forName: Notification.Name("com.squadd.clotch.\(name)"), object: nil, queue: .main) { _ in
                Task { await run() }
            }
        }
        DistributedNotificationCenter.default().addObserver(forName: Notification.Name("com.squadd.clotch.dettatura"), object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                // Not Roberto's key: with the dictation off it does nothing, it never paints his screen red (#245).
                guard VoiceInput.Config((try? VoiceFiles().readConfig()) ?? [:]).enabled else {
                    Self.log.notice("dettatura: local command ignored, dictation off")
                    return
                }
                Self.log.notice("dettatura: local command")
                self?.executeShortcut(.voiceInput)
            }
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        VoiceSpeaker.shared.stop()
        MacBridge.shared.stop()
    }

    // Closing the settings window (X, Cmd+W) leaves Clotch running; only Quit ends it (#70).
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    // The notch panel is always a visible window, so the Dock click ignores the flag.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        SettingsWindowController.shared.show()
        return false
    }

    // MARK: - Global Shortcuts

    func setupGlobalShortcut() {
        teardownGlobalShortcut()

        // Collect all enabled shortcut bindings, skip duplicates (first wins)
        var bindings: [(keyCode: UInt16, mods: NSEvent.ModifierFlags, action: ShortcutAction)] = []
        var seen: Set<String> = []
        // Clotch: only the panel toggle and the voice; the card shortcuts would grab keys system-wide for cards that never show.
        for action in [ShortcutAction.togglePanel, .voiceInput] {
            guard action.isEnabled else { continue }
            let b = action.binding
            let key = "\(b.keyCode)-\(b.modifiers.rawValue)"
            guard seen.insert(key).inserted else { continue }
            bindings.append((b.keyCode, b.modifiers, action))
        }
        guard !bindings.isEmpty else { return }

        // Global path: Carbon RegisterEventHotKey fires from any frontmost app
        // and — unlike an NSEvent global keyboard monitor — needs no
        // Accessibility permission. This is the primary handler. See #217.
        for b in bindings {
            // The voice is push to talk too: Carbon also tells when the key goes up.
            let up: (() -> Void)? = b.action == .voiceInput ? { Task { @MainActor in VoiceInputController.shared.release() } } : nil
            let id = hotKeyManager.registerID(keyCode: b.keyCode, modifiers: b.mods, onRelease: up) { [weak self] in
                Task { @MainActor in self?.executeShortcut(b.action) }
            }
            if id == nil, b.action == .voiceInput { VoiceInputController.shared.shortcutNotRegistered() }
        }

        // Local monitor: same-app fallback so the shortcut still works (and is
        // swallowed) while Clotch's own panel/settings window is focused.
        let localHandler: (NSEvent) -> Bool = { [weak self] event in
            let eventMods = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
            for b in bindings where event.keyCode == b.keyCode && eventMods == b.mods {
                Task { @MainActor in self?.executeShortcut(b.action) }
                return true
            }
            return false
        }
        localShortcutMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            localHandler(event) ? nil : event
        }
    }

    private func teardownGlobalShortcut() {
        hotKeyManager.unregisterAll()
        if let m = localShortcutMonitor { NSEvent.removeMonitor(m) }
        localShortcutMonitor = nil
    }

    private func executeShortcut(_ action: ShortcutAction) {
        switch action {
        case .togglePanel:
            if appState.surface.isExpanded {
                withAnimation(NotchAnimation.close) { appState.surface = .collapsed }
            } else {
                withAnimation(NotchAnimation.open) {
                    appState.surface = .sessionList
                    appState.cancelCompletionQueue()
                    if appState.activeSessionId == nil {
                        appState.activeSessionId = appState.sessions.keys.sorted().first
                    }
                }
            }
        case .voiceInput:
            if appState.surface.isExpanded { withAnimation(NotchAnimation.close) { appState.surface = .collapsed } }
            VoiceInputController.shared.press()
        // Card shortcuts act only on the card on screen (#308); with the
        // request hidden they open its card instead of acting unseen.
        case .approve, .approveAlways, .deny, .skipQuestion:
            appState.performCardShortcut(action)
        case .jumpToTerminal:
            if let id = appState.activeSessionId, let session = appState.sessions[id] {
                TerminalActivator.activate(session: session, sessionId: id)
            }
        }
    }
}
