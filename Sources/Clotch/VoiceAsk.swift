import Foundation
import ClotchCore

/// A spoken question (#110): `claude -p` with Haiku and read-only tools, the question on stdin, at most `timeout` seconds.
/// A failure says why (no `claude`, no account with a login, timeout…), for the bar (#159).
enum VoiceAsk {
    static let timeout: TimeInterval = 45

    static func run(_ question: String) async -> Result<String, ClaudeLogin.Failure> {
        await ClaudeRun.run(VoiceRoute.askArguments(), input: VoiceRoute.askInput(question), timeout: timeout,
                            directory: FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".claude"))
    }
}
