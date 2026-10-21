import AppKit
import CodeIslandCore

/// Emails of the accounts whose Claude desktop app runs on this Mac now (`AccountsInUse`).
/// Updated on app launch and quit notifications only: no polling.
@MainActor final class AccountsInUseFeed: ObservableObject {
    static let shared = AccountsInUseFeed()

    @Published private(set) var emails: Set<String> = []
    private var observers: [NSObjectProtocol] = []

    func start() {
        guard observers.isEmpty else { return }
        let center = NSWorkspace.shared.notificationCenter
        for name in [NSWorkspace.didLaunchApplicationNotification, NSWorkspace.didTerminateApplicationNotification] {
            observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in self?.refresh() }
            })
        }
        refresh()
    }

    private func refresh() {
        let running = Set(NSWorkspace.shared.runningApplications.compactMap { app in
            app.bundleURL.flatMap { AccountsInUse.email(bundleName: $0.lastPathComponent) }
        })
        if running != emails { emails = running }
    }
}
