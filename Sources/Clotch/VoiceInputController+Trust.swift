import AppKit
import CoreGraphics
import ClotchCore

/// Voce fidata (#1120): «Ho sentito» the moment he stops, the voice checked against his print.
extension VoiceInputController {
    /// The Mac is on the lock screen or the screen saver asks for a password.
    static var macLocked: Bool {
        (CGSessionCopyCurrentDictionary() as? [String: Any])?["CGSSessionScreenIsLocked"] as? Bool ?? false
    }

    /// A short sound as soon as he stops (the second press, or the key going up), before any transcript or answer.
    /// `heardAfter` records the milliseconds from the stop to the sound being handed to the system, for the proof (#1120).
    func acknowledge(stoppedAt: Date) {
        play("Tink")
        heardAfter = Date().timeIntervalSince(stoppedAt) * 1000
        Self.log.notice("heard: sound \(Int(self.heardAfter)) ms after the stop")
    }

    /// nil = go on; otherwise the pill already says why nothing happens. Nothing is acted on unless the dictation started from the key,
    /// the Mac is unlocked and the voice is his: «uncertain» and «no» do not act, at most they ask again.
    func admit(run me: Int) async -> (verdict: VoiceTrust.Verdict, distance: Float)? {
        guard trustStore.exists else { show(failure: .noVoiceprint); return nil }
        guard unlocked() else { show(failure: .locked); return nil }
        let heard = await verify(samples.all)
        guard me == run else { return nil }
        Self.log.notice("voice: \(heard.verdict.rawValue, privacy: .public), distance \(heard.distance, privacy: .public)")  // numbers only, never the print
        guard VoiceTrust.accepted(fromKey: fromKey, unlocked: unlocked(), verdict: heard.verdict) else {
            show(failure: heard.verdict == .no ? .notYou : .unsure)
            return nil
        }
        return heard
    }

    private func play(_ name: String) { (soundPlayer ?? { NSSound(named: $0)?.play() })(name) }
}
