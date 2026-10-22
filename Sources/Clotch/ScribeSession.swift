import Foundation
import ClotchCore
import os.log

private let log = Logger(subsystem: ClotchLog.subsystem, category: "VoiceInput")

/// One utterance on ElevenLabs Scribe v2 Realtime (#110): the socket, the key in the `xi-api-key` header only (never in the URL),
/// audio chunks in, partial and committed text out (`VoiceInput.scribeEvent`). The wire format and its tests live in the Core.
final class ScribeSession: @unchecked Sendable {
    private var task: URLSessionWebSocketTask?
    private var closed = false
    /// Called on a background thread: the owner hops to the main actor.
    var onEvent: (@Sendable (VoiceInput.ScribeEvent) -> Void)?

    func open(key: String, language: String) {
        var request = URLRequest(url: VoiceInput.scribeURL(language: language))
        request.setValue(key, forHTTPHeaderField: "xi-api-key")
        let t = URLSession.shared.webSocketTask(with: request)
        task = t
        t.resume()
        receive(t)
    }

    /// Sends are queued by the task, so the order of the calls is the order on the wire.
    func send(_ pcm: Data, commit: Bool = false) {
        task?.send(.string(VoiceInput.scribeChunk(pcm: pcm, commit: commit))) { [weak self] error in
            if let error {
                log.error("scribe send: \(error.localizedDescription, privacy: .public)")
                self?.fail(.network)
            }
        }
    }

    /// 100 ms of silence that closes the segment: the committed text comes back for the whole utterance.
    func commit() { send(Data(count: VoiceInput.sampleRate / 10 * 2), commit: true) }

    func close() {
        closed = true
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
    }

    private func receive(_ t: URLSessionWebSocketTask) {
        t.receive { [weak self] result in
            guard let self, !closed else { return }
            switch result {
            case .success(let message):
                if case .string(let text) = message {
                    let event = VoiceInput.scribeEvent(text)
                    if case .failure = event { log.error("scribe said: \(text, privacy: .public)") }  // #314: the cause, word for word
                    onEvent?(event)
                }
                receive(t)
            case .failure(let error):
                let status = (t.response as? HTTPURLResponse)?.statusCode ?? 0
                let reason = t.closeReason.map { String(decoding: $0, as: UTF8.self) } ?? ""
                log.error("scribe socket: \(error.localizedDescription, privacy: .public), http \(status), close \(t.closeCode.rawValue) \(reason, privacy: .public)")
                fail(VoiceInput.failure(httpStatus: status))
            }
        }
    }

    private func fail(_ why: VoiceInput.Failure) {
        guard !closed else { return }
        closed = true
        onEvent?(.failure(why))
    }
}
