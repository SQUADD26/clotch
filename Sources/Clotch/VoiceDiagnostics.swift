import Foundation
import os.log
import ClotchCore

/// Live checks of the outgoing voice, run by local commands (#251). They log, never print the key: it only goes in the `xi-api-key` header.
@MainActor
enum VoiceDiagnostics {
    private static let log = Logger(subsystem: "com.squadd.clotch", category: "Voice")

    private static func get(_ url: String, key: String) async -> [String: Any]? {
        guard let u = URL(string: url) else { return nil }
        var r = URLRequest(url: u)
        r.setValue(key, forHTTPHeaderField: "xi-api-key")
        guard let (data, _) = try? await URLSession.shared.data(for: r) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    /// `com.squadd.clotch.voci-italiane`: Italian voices of the shared library and Roberto's own, one log line each.
    static func listItalianVoices() async {
        guard let key = VoiceFiles().key else { return log.error("voices: no key") }
        let urls = ["https://api.elevenlabs.io/v1/shared-voices?language=it&accent=italian&page_size=30",
                    "https://api.elevenlabs.io/v1/voices"]
        for url in urls {
            let d = await get(url, key: key)
            let list = (d?["voices"] as? [[String: Any]]) ?? []
            log.notice("voices: \(url.contains("shared") ? "shared" : "own", privacy: .public) \(list.count) found \(d?["detail"] != nil ? "error" : "", privacy: .public)")
            for v in list {
                let l = v["labels"] as? [String: Any] ?? [:]
                let id = v["voice_id"] as? String ?? ""
                let line = "\(v["name"] ?? "?") | \(id) | \(v["gender"] ?? l["gender"] ?? "?") | \(v["accent"] ?? l["accent"] ?? "?") | \(v["language"] ?? l["language"] ?? "?") | \(v["descriptive"] ?? l["descriptive"] ?? "") | \(v["use_case"] ?? l["use_case"] ?? "") | public_owner \(v["public_owner_id"] ?? "-")"
                log.notice("voice candidate: \(line, privacy: .public)")
            }
        }
    }

    /// `com.squadd.clotch.verifica-voce`: says a long Italian sentence with Roberto's settings, then asks Scribe which language it hears.
    static func verifyLanguage() async {
        let files = VoiceFiles()
        guard let key = files.key else { return log.error("verify: no key") }
        let config = VoiceTurn.Config((try? files.readConfig()) ?? [:])
        let text = "Buongiorno Roberto, la sessione ha finito il lavoro e la prova è andata bene. Adesso controllo se la voce parla davvero in italiano."
        let request = VoiceTurn.speechRequest(text: text, config: config, key: key, pronunciation: [:])
        guard let (audio, _) = try? await URLSession.shared.data(for: request), audio.count > 500 else { return log.error("verify: no audio") }
        let boundary = "b\(UUID().uuidString)"
        var body = Data()
        func field(_ n: String, _ v: String) { body.append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(n)\"\r\n\r\n\(v)\r\n".data(using: .utf8)!) }
        field("model_id", "scribe_v1")
        body.append("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.mp3\"\r\nContent-Type: audio/mpeg\r\n\r\n".data(using: .utf8)!)
        body.append(audio)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        var r = URLRequest(url: URL(string: "https://api.elevenlabs.io/v1/speech-to-text")!)
        r.httpMethod = "POST"
        r.setValue(key, forHTTPHeaderField: "xi-api-key")
        r.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        r.httpBody = body
        guard let (data, _) = try? await URLSession.shared.data(for: r),
              let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return log.error("verify: Scribe did not answer") }
        log.notice("verify: voice \(config.voiceId, privacy: .public), model \(config.model, privacy: .public), Scribe hears language \(o["language_code"] as? String ?? "?", privacy: .public), confidence \(o["language_probability"] as? Double ?? -1, privacy: .public), text: \(o["text"] as? String ?? "", privacy: .public)")
    }
}
