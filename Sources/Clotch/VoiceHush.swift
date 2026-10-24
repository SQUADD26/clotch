import Foundation

/// claude-config#2572 / clotch#456 «zitto»: the engine's one way to silence Clotch posts `com.squadd.clotch.interrompi-voce`
/// (distributed notification, same login session, like `dettatura`). The voice that speaks stops and so does the listening.
extension VoiceInputController {
    static let hushName = Notification.Name("com.squadd.clotch.interrompi-voce")

    func hush() {
        VoiceSpeaker.shared.hush()
        // Only the listening is cut: an order waiting for its «Annulla» or an answer on screen is Roberto's to take back.
        if phase == .ready || phase == .listening || phase == .finishing { cancel() }
    }

    func listenForHush(on center: NotificationCenter = DistributedNotificationCenter.default()) {
        center.addObserver(forName: Self.hushName, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.hush() }
        }
    }
}
