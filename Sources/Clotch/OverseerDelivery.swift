import AppKit
import ClotchCore

/// An order for the Overseer (#110): a file in the inbox, which the Clean View mod in the Overseer's chat submits as a message and
/// moves it away (gone = received). The mod touches `.ascolta` while it listens: with that sign the file is never taken back, even
/// if the reader is busy past `inboxGrace` (#200). Without it the text goes to the clipboard, so nothing is lost.
@MainActor
enum OverseerDelivery {
    enum Outcome { case sent, queued, copied }

    static func send(_ text: String, files: VoiceFiles = VoiceFiles(), grace: TimeInterval = VoiceRoute.inboxGrace) async -> Outcome {
        let now = Date()
        let id = String(UUID().uuidString.prefix(8)).lowercased()
        let url = files.inboxURL.appendingPathComponent(VoiceRoute.inboxName(id: id, at: now))
        let heard = (try? FileManager.default.attributesOfItem(atPath: files.inboxListenerURL.path)[.modificationDate]) as? Date
        guard VoiceRoute.listenerIsFresh(modified: heard), (try? files.write(VoiceRoute.inboxPayload(id: id, text: text, at: now), to: url)) != nil
        else { return fallback(text) }
        let deadline = now.addingTimeInterval(grace)
        while Date() < deadline {
            if !FileManager.default.fileExists(atPath: url.path) { return .sent }
            try? await Task.sleep(nanoseconds: 250_000_000)
        }
        return .queued  // the reader is alive but busy (one order at a time, up to 120 s): the file stays with it
    }

    /// Tests record the fallback instead of touching the clipboard.
    static var onFallback: ((String) -> Void)?

    private static func fallback(_ text: String) -> Outcome {
        if let onFallback { onFallback(text); return .copied }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        return .copied
    }
}
