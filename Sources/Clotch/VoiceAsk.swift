import Foundation
import ClotchCore

/// A spoken question (#110): `claude -p` with the Friday's model (Impostazioni › Dettatura, clotch#286) and read-only tools, the question on stdin, at most `timeout` seconds.
/// A failure says why (no `claude`, no account with a login, timeout…), for the bar (#159).
enum VoiceAsk {
    static let timeout: TimeInterval = 45

    /// The sessions Clotch sees, one line each (set at launch): the answer starts from them, not from thousands of files (#174).
    @MainActor static var sessions: () -> [String] = { [] }

    /// The helper's instructions (claude-config#2116), read at every utterance so a config update needs no restart; nil = the way of before.
    /// Read from `files`; a test that reaches the real home's prompt would launch the real helper (#270), so it stops here.
    static func helperPrompt(files: VoiceFiles) -> String? {
        let url = files.helperPromptURL
        if RuntimeEnvironment.isRunningTests, url.standardizedFileURL == VoiceFiles().helperPromptURL.standardizedFileURL {
            fatalError("Un test ha letto il prompt vero dell'helper vocale (\(url.path)): usa VoiceFiles(home: <cartella temporanea>) (#270)")
        }
        guard let s = try? String(contentsOf: url, encoding: .utf8), !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        return s
    }

    /// With `helper`, the helper's `claude -p` (answers, talks to the sessions, passes new work to the Friday); without, read-only.
    static func run(_ question: String, helper: String? = nil) async -> Result<String, ClaudeLogin.Failure> {
        let sessions = await MainActor.run { Self.sessions() }
        let model = VoiceInput.Config((try? VoiceFiles().readConfig()) ?? [:]).overseerModel  // clotch#286: the Friday Roberto chose
        return await ClaudeRun.run(helper.map { VoiceRoute.helperArguments(prompt: $0, model: model) } ?? VoiceRoute.askArguments(model: model),
                            input: VoiceRoute.askInput(question, sessions: sessions), timeout: helper == nil ? timeout : VoiceRoute.helperSeconds(model),
                            directory: FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".claude"))
    }
}
