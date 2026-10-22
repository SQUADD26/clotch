import AppKit
import ApplicationServices
import AVFoundation
import CoreGraphics
import ClotchCore

/// The macOS permissions Clotch holds for itself and for the engine scripts it
/// runs through `MacBridge` (clotch#283). Asked once, never while «non
/// disturbare» is on (Roberto may be in a call). The Settings view of what is
/// missing waits for its Figma frame (clotch#283).
enum MacPermission: String, CaseIterable {
    case accessibility, automation, screenRecording, microphone

    /// True when granted. Never shows a dialog.
    var isGranted: Bool {
        switch self {
        case .accessibility: return AXIsProcessTrusted()
        case .automation: return MacPermission.automationStatus(ask: false) == noErr
        case .screenRecording: return CGPreflightScreenCaptureAccess()
        case .microphone: return AVCaptureDevice.authorizationStatus(for: .audio) == .authorized
        }
    }

    static let systemEvents = "com.apple.systemevents"

    /// noErr granted, -1744 not asked yet, -1743 denied, -600 System Events not running.
    static func automationStatus(ask: Bool) -> OSStatus {
        let target = NSAppleEventDescriptor(bundleIdentifier: systemEvents)
        return AEDeterminePermissionToAutomateTarget(target.aeDesc, typeWildCard, typeWildCard, ask)
    }

    static var missing: [MacPermission] { allCases.filter { !$0.isGranted } }
}

enum MacPermissionsAsker {
    static let askedKey = "macPermissionsAsked"

    /// Asks once for every missing permission. While «non disturbare» is on it
    /// waits and retries every minute, so no dialog lands during a call.
    @MainActor
    static func askOnceWhenFree(defaults: UserDefaults = .standard, dnd: DoNotDisturb = DoNotDisturb()) {
        if RuntimeEnvironment.isRunningTests || defaults.bool(forKey: askedKey) { return }
        if dnd.isOn {
            DispatchQueue.main.asyncAfter(deadline: .now() + 60) { askOnceWhenFree(defaults: defaults, dnd: dnd) }
            return
        }
        defaults.set(true, forKey: askedKey)
        let missing = MacPermission.missing
        if missing.contains(.accessibility) {
            _ = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary)
        }
        if missing.contains(.screenRecording) { _ = CGRequestScreenCaptureAccess() }
        if missing.contains(.microphone) { AVCaptureDevice.requestAccess(for: .audio) { _ in } }
        if missing.contains(.automation) {
            DispatchQueue.global().async {
                // The consent dialog needs System Events running; it blocks until answered.
                if MacPermission.automationStatus(ask: true) == OSStatus(procNotFound),
                   let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: MacPermission.systemEvents) {
                    let config = NSWorkspace.OpenConfiguration()
                    config.activates = false
                    NSWorkspace.shared.openApplication(at: url, configuration: config) { _, _ in
                        _ = MacPermission.automationStatus(ask: true)
                    }
                }
            }
        }
    }
}
