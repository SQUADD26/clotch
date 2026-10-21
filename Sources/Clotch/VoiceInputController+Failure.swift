import AVFoundation
import AppKit
import ClotchCore

/// The error pills of #110 (Figma note 5 and 6), their buttons, and Esc for the length of a dictation.
extension VoiceInputController {
    /// The microphone error waits for the permission; the others fold after a while.
    func show(failure why: VoiceInput.Failure) {
        end(.failure(why), seconds: why == .mic ? 300 : 20)
        if why == .mic { timers.append(watchMicrophone()) }
    }

    /// The button under the error.
    func perform(_ action: VoiceInput.Action) {
        switch action {
        case .openPrivacy:
            NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")!)
        case .checkKey:
            SettingsWindowController.shared.show()
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
                guard let self, me == run, phase == .failure(.mic) else { return }
                if AVCaptureDevice.authorizationStatus(for: .audio) == .authorized { return await begin() }
            }
        }
    }

    // MARK: - Esc

    /// Esc takes the dictation back while it is open (Carbon hotkey, as the shortcut itself: no Accessibility permission).
    func armEscape() {
        guard escapeID == nil, let keys = (NSApp.delegate as? AppDelegate)?.hotKeyManager else { return }
        escapeID = keys.registerID(keyCode: 53, modifiers: []) { [weak self] in Task { @MainActor in self?.cancel() } }
    }

    func disarmEscape() {
        guard let id = escapeID else { return }
        (NSApp.delegate as? AppDelegate)?.hotKeyManager.unregister(id: id)
        escapeID = nil
    }
}
