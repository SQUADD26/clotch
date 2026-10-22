import AppKit
import ClotchCore

/// An order for the Friday (#110): a file in the inbox, which the Clean View mod in the Friday's chat submits as a message and
/// takes it away (gone = only taken: the outcome is the engine's `.esiti`, #262). The mod touches `.ascolta` while it listens: with that sign the file is never taken back, even
/// if the reader is busy past `inboxGrace` (#200). Without it the text goes to the clipboard, so nothing is lost.
@MainActor
enum OverseerDelivery {
    enum Outcome { case sent, queued, copied, notDelivered }  // notDelivered: no proof from the engine, text on the clipboard

    static func send(_ text: String, files: VoiceFiles = VoiceFiles(), grace: TimeInterval = VoiceRoute.inboxGrace) async -> Outcome {
        let now = Date()
        let id = String(UUID().uuidString.prefix(8)).lowercased()
        let url = files.inboxURL.appendingPathComponent(VoiceRoute.inboxName(id: id, at: now))
        let heard = (try? FileManager.default.attributesOfItem(atPath: files.inboxListenerURL.path)[.modificationDate]) as? Date
        guard VoiceRoute.listenerIsFresh(modified: heard), (try? files.write(VoiceRoute.inboxPayload(id: id, text: text, at: now), to: url)) != nil
        else { return fallback(text) }
        let deadline = now.addingTimeInterval(grace)
        while Date() < deadline {
            if !FileManager.default.fileExists(atPath: url.path) {
                switch VoiceRoute.delivery(esiti: esiti([files.outcomesURL.appendingPathComponent(url.lastPathComponent)])) {
                case .delivered: return .sent
                case .notDelivered: return keep(text)
                case .unproven: break  // taken, still in_consegna (or nothing written yet)
                }
            }
            try? await Task.sleep(nanoseconds: 250_000_000)
        }
        // the reader is alive but busy (one order at a time, up to 120 s): the file stays with it; gone without a proven outcome is not «sent»
        return FileManager.default.fileExists(atPath: url.path) ? .queued : keep(text)
    }

    /// An order the helper handled (#262): what Roberto hears comes from the `.esiti` of the orders this run left in the inbox, never from the
    /// model's text. The helper passing the order another way (`apri`, a session without a reader) leaves no esito: not proven, said so.
    static func afterHelper(_ text: String, since: Date, files: VoiceFiles = VoiceFiles(), grace: TimeInterval = VoiceRoute.inboxGrace) async -> Outcome {
        let deadline = Date().addingTimeInterval(grace)
        repeat {
            let mine = fresh(files.outcomesURL, since: since)
            switch VoiceRoute.delivery(esiti: esiti(mine)) {
            case .delivered: return .sent
            case .notDelivered: return keep(text)
            case .unproven: break
            }
            if mine.isEmpty && fresh(files.inboxURL, since: since).isEmpty { break }  // no order of this run in the inbox: nothing to wait for
            try? await Task.sleep(nanoseconds: 250_000_000)
        } while Date() < deadline
        return keep(text)
    }

    private static func esiti(_ urls: [URL]) -> [Data] { urls.compactMap { try? Data(contentsOf: $0) } }

    private static func fresh(_ dir: URL, since: Date) -> [URL] {
        ((try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.contentModificationDateKey], options: .skipsHiddenFiles)) ?? [])
            .filter { ((try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast) >= since }
    }

    private static func keep(_ text: String) -> Outcome { _ = fallback(text); return .notDelivered }

    /// Tests record the fallback instead of touching the clipboard.
    static var onFallback: ((String) -> Void)?

    private static func fallback(_ text: String) -> Outcome {
        if let onFallback { onFallback(text); return .copied }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        return .copied
    }
}
