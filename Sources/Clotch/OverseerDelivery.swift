import AppKit
import ClotchCore

/// An order for the Overseer (#110): a file in the inbox, which the Clean View mod in the Overseer's chat submits as a message and
/// deletes (deleted = received). The mod touches `.ascolta` while it listens; without that sign, or if the file stays `inboxGrace`
/// seconds, the text goes to the clipboard and the Overseer's chat opens, so nothing is lost.
@MainActor
enum OverseerDelivery {
    enum Outcome { case sent, copied }

    static func send(_ text: String, files: VoiceFiles = VoiceFiles()) async -> Outcome {
        let now = Date()
        let id = String(UUID().uuidString.prefix(8)).lowercased()
        let url = files.inboxURL.appendingPathComponent(VoiceRoute.inboxName(id: id, at: now))
        let heard = (try? FileManager.default.attributesOfItem(atPath: files.inboxListenerURL.path)[.modificationDate]) as? Date
        guard VoiceRoute.listenerIsFresh(modified: heard), (try? files.write(VoiceRoute.inboxPayload(id: id, text: text, at: now), to: url)) != nil
        else { return await fallback(text, files: files) }
        let deadline = now.addingTimeInterval(VoiceRoute.inboxGrace)
        while Date() < deadline {
            if !FileManager.default.fileExists(atPath: url.path) { return .sent }
            try? await Task.sleep(nanoseconds: 250_000_000)
        }
        // Removing fails when the mod took it in the meantime: then it was received.
        return (try? FileManager.default.removeItem(at: url)) == nil ? .sent : await fallback(text, files: files)
    }

    /// The pilot's test records the fallback instead of touching the clipboard and the chat.
    static var onFallback: ((String) -> Void)?

    private static func fallback(_ text: String, files: VoiceFiles) async -> Outcome {
        if let onFallback { onFallback(text); return .copied }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        if let id = (try? Data(contentsOf: files.overseerURL)).flatMap(VoiceRoute.overseerLocalId) {
            let profile = await GoalStore.shared.allSessions().first { $0.localId == id }?.profile ?? ""
            SessionOpener.open(SessionTarget(localId: id, profile: profile))
        }
        return .copied
    }
}
