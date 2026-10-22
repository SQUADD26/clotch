import Foundation
import ClotchCore

/// A spoken question (#110): `claude -p` with Haiku and read-only tools, the question on stdin, at most `timeout` seconds.
/// A failure says why (no `claude`, no account with a login, timeout…), for the bar (#159).
enum VoiceAsk {
    static let timeout: TimeInterval = 45

    /// The sessions Clotch sees, one line each (set at launch): the answer starts from them, not from thousands of files (#174).
    @MainActor static var sessions: () -> [String] = { [] }

    /// The helper may wait for `dai-ok` to start a session's turn (claude-config#2116).
    static let helperTimeout: TimeInterval = 90

    /// The helper's instructions (claude-config#2116), read at every utterance so a config update needs no restart; nil = the way of before.
    static func helperPrompt() -> String? {
        let url = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(VoiceRoute.helperPromptPath)
        guard let s = try? String(contentsOf: url, encoding: .utf8), !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        return s
    }

    /// With `helper`, the helper's `claude -p` (answers, talks to the sessions, passes new work to the Overseer); without, read-only.
    static func run(_ question: String, helper: String? = nil) async -> Result<String, ClaudeLogin.Failure> {
        let sessions = await MainActor.run { Self.sessions() }
        return await ClaudeRun.run(helper.map { VoiceRoute.helperArguments(prompt: $0) } ?? VoiceRoute.askArguments(),
                            input: VoiceRoute.askInput(question, sessions: sessions), timeout: helper == nil ? timeout : helperTimeout,
                            directory: FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".claude"))
    }
}
