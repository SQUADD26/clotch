import Foundation
import ClotchCore

/// A spoken question (#110): `claude -p` with Haiku and read-only tools, the question on stdin, at most `timeout` seconds.
/// A failure says why (no `claude`, no account with a login, timeout…), for the bar (#159).
enum VoiceAsk {
    static let timeout: TimeInterval = 45

    /// The sessions Clotch sees, one line each (set at launch): the answer starts from them, not from thousands of files (#174).
    @MainActor static var sessions: () -> [String] = { [] }

    static func run(_ question: String) async -> Result<String, ClaudeLogin.Failure> {
        let sessions = await MainActor.run { Self.sessions() }
        return await ClaudeRun.run(VoiceRoute.askArguments(), input: VoiceRoute.askInput(question, sessions: sessions), timeout: timeout,
                            directory: FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".claude"))
    }
}
