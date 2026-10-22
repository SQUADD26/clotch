import Foundation
import os.log
import ClotchCore

/// Every `claude -p` Clotch starts (#159): with the CLAUDE_CONFIG_DIR of an account that has a login (`ClaudeLogin`),
/// stderr and exit status in the log, and a failure that says why instead of a silent nil.
enum ClaudeRun {
    private static let log = Logger(subsystem: ClotchLog.subsystem, category: "ClaudeRun")
    private static let lock = NSLock()
    nonisolated(unsafe) private static var chosen: (folder: String, at: Date)?
    /// A pick is kept this long; a login failure drops it at once.
    static let keep: TimeInterval = 600

    static func run(_ arguments: [String], input: String, timeout: TimeInterval, directory: URL? = nil) async -> Result<String, ClaudeLogin.Failure> {
        let ranked = await MainActor.run { AccountQuotaFeed.shared.accounts.map(\.email) }
        return await Task.detached { () -> Result<String, ClaudeLogin.Failure> in
            guard let bin = VoiceSpeaker.claudeBinary() else { return failed(.noBinary, "no claude binary") }
            guard let folder = account(bin: bin, ranked: ranked) else { return failed(.noAccount, "no config folder with a login") }
            let p = Process()
            p.executableURL = URL(fileURLWithPath: bin)
            p.arguments = arguments
            p.currentDirectoryURL = directory
            p.environment = environment(folder)
            let stdin = Pipe(), stdout = Pipe(), stderr = Pipe()
            p.standardInput = stdin
            p.standardOutput = stdout
            p.standardError = stderr
            do { try p.run() } catch { return failed(.failed, "launch: \(error)") }
            stdin.fileHandleForWriting.write(Data(input.utf8))
            try? stdin.fileHandleForWriting.close()
            let timer = DispatchWorkItem { p.terminate() }
            DispatchQueue.global().asyncAfter(deadline: .now() + timeout, execute: timer)
            // stderr is drained on its own thread, so a chatty stderr never blocks the stdout read.
            let errBox = Box(), errDone = DispatchSemaphore(value: 0)
            DispatchQueue.global().async { errBox.data = stderr.fileHandleForReading.readDataToEndOfFile(); errDone.signal() }
            let out = String(decoding: stdout.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
            errDone.wait()
            p.waitUntilExit()
            timer.cancel()
            let err = String(decoding: errBox.data, as: UTF8.self)
            // Only the timer sends a signal: a signal exit is the timeout.
            let result = ClaudeLogin.outcome(status: p.terminationStatus, timedOut: p.terminationReason == .uncaughtSignal, stdout: out, stderr: err)
            if case .failure(let why) = result {
                if why == .notLoggedIn { forget(folder) }
                log.error("claude failed (\(String(describing: why), privacy: .public)) exit \(p.terminationStatus) folder \(folder, privacy: .public) stderr: \(err.suffix(2000), privacy: .public) stdout: \(out.suffix(500), privacy: .public)")
            }
            return result
        }.value
    }

    /// The env of every `claude`: the account folder, and the mark the Stop hook uses to skip Clotch's own calls.
    static func environment(_ folder: String, base: [String: String] = ProcessInfo.processInfo.environment) -> [String: String] {
        var env = base
        env["CLAUDE_CONFIG_DIR"] = folder
        env["CLOTCH_VOCE_INTERNA"] = "1"
        return env
    }

    private final class Box: @unchecked Sendable { var data = Data() }

    private static func failed(_ why: ClaudeLogin.Failure, _ detail: String) -> Result<String, ClaudeLogin.Failure> {
        log.error("claude not started (\(String(describing: why), privacy: .public)): \(detail, privacy: .public)")
        return .failure(why)
    }

    private static func account(bin: String, ranked: [String]) -> String? {
        lock.lock()
        if let c = chosen, Date().timeIntervalSince(c.at) < keep { lock.unlock(); return c.folder }
        lock.unlock()
        let folders = ClaudeLogin.ordered(
            ClaudeLogin.folders(home: NSHomeDirectory(), primary: ClaudeConfigPaths.configDir(), extras: ExtraConfigDirs.enabledPaths(for: .claude)),
            ranked: ranked, email: ClaudeLogin.email(folder:))
        let picked = ClaudeLogin.pick(folders) { folder in
            ProcessRunner.run(path: bin, args: ["auth", "status", "--json"], env: environment(folder), timeout: 5)
                .map(ClaudeLogin.isLoggedIn(statusJSON:)) ?? false
        }
        log.notice("claude account: \(picked ?? "none", privacy: .public) of \(folders.count) folders")
        lock.lock()
        chosen = picked.map { ($0, Date()) }
        lock.unlock()
        return picked
    }

    private static func forget(_ folder: String) {
        lock.lock()
        if chosen?.folder == folder { chosen = nil }
        lock.unlock()
    }
}
