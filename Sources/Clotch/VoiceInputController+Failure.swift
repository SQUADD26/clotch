import AVFoundation
import AppKit
import ClotchCore

/// The error pills of #110 (Figma note 5 and 6), their buttons, and Esc for the length of a dictation.
extension VoiceInputController {
    /// The phase without the answer's text: a result's words stay out of the log.
    static func label(_ phase: Phase) -> String {
        if case .result = phase { return "result" }
        return String(describing: phase)
    }

    /// A line on the pill for a while, then the pill folds away.
    func show(_ message: String, seconds: Double = 3) { end(.result(message), seconds: seconds) }

    /// Every error folds after 8 s; the microphone's watcher goes on in the background and restarts when macOS says yes.
    func show(failure why: VoiceInput.Failure) {
        end(.failure(why), seconds: 8)
        if why == .mic { timers.append(watchMicrophone()) }
    }

    /// RegisterEventHotKey said no (another program owns the key): the pill says it instead of a key that does nothing (#198).
    func shortcutNotRegistered() { show(failure: .shortcut) }

    /// The button under the error.
    func perform(_ action: VoiceInput.Action) {
        switch action {
        case .openPrivacy:
            NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")!)
        case .checkKey:
            SettingsWindowController.shared.show()
            cancel()
        case .openDictation:
            SettingsWindowController.shared.show(tab: .dictation)
            cancel()
        case .useLocal:
            try? files.updateConfig(["ingresso_motore": VoiceInput.Engine.local.rawValue])
            Task { await begin() }
        case .retry:
            Task { await begin() }
        }
    }

    /// «Appena lo fai, torno ad ascoltare»: when macOS says yes, the dictation restarts by itself.
    private func watchMicrophone() -> Task<Void, Never> {
        let me = run
        return Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard let self, me == run, phase == .failure(.mic) || phase == .idle else { return }  // idle: the error folded, the watch goes on
                if AVCaptureDevice.authorizationStatus(for: .audio) == .authorized { return await begin() }
            }
        }
    }

    // MARK: - Esc

    /// Esc takes the dictation back while it is open (Carbon hotkey, as the shortcut itself: no Accessibility permission).
    func armEscape() {
        guard escapeID == nil, let keys = (NSApp?.delegate as? AppDelegate)?.hotKeyManager else { return }
        escapeID = keys.registerID(keyCode: 53, modifiers: []) { [weak self] in Task { @MainActor in self?.cancel() } }
    }

    func disarmEscape() {
        guard let id = escapeID else { return }
        (NSApp?.delegate as? AppDelegate)?.hotKeyManager.unregister(id: id)
        escapeID = nil
    }
}
