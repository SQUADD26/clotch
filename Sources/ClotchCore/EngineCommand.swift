import Foundation
#if canImport(os)
import os.log
#endif

/// The one launcher of the engine's commands (#263): `richieste.py`, `obiettivo-guard.py`, `voce`. stderr and exit status
/// go to the log (category EngineCommand) and come back in the result, so the caller can say it failed instead of showing an old card.
public enum EngineCommand {
    public enum Failure: Error, Equatable {
        case notStarted
        case exit(status: Int32, stderr: String)

        /// One sentence for the view. The status and stderr go to the log, never here.
        public var message: String {
            switch self {
            case .notStarted: return "Non riesco ad avviare il motore. Dettagli nel log di Clotch."
            case .exit: return "Il motore non ha risposto. Dettagli nel log di Clotch."
            }
        }
    }

    /// `python3` of the Mac running `args` (the script first). A Dock-launched app has no Homebrew in PATH, so it is looked up.
    public static func python(_ args: [String], log: @escaping (String) -> Void = defaultLog) -> Result<Data, Failure> {
        guard let py = ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"]
            .first(where: FileManager.default.isExecutableFile(atPath:)) else {
            log("python3 not found: \(args.prefix(2).joined(separator: " "))")
            return .failure(.notStarted)
        }
        return run(py, args, log: log)
    }

    /// stdout on exit 0. Roberto is not a session: with CLAUDE_CODE_SESSION_ID the engine's commands may refuse (exit 3).
    /// stdin is closed: a mode the script does not know yet would read it as a hook.
    public static func run(_ executable: String, _ args: [String], env: [String: String] = [:],
                           log: @escaping (String) -> Void = defaultLog) -> Result<Data, Failure> {
        let process = Process(), out = Pipe(), err = Pipe()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = args
        var environment = ProcessInfo.processInfo.environment.merging(env) { $1 }
        environment["CLAUDE_CODE_SESSION_ID"] = nil
        process.environment = environment
        process.standardInput = FileHandle.nullDevice
        process.standardOutput = out
        process.standardError = err
        let name = ([executable] + args).prefix(2).joined(separator: " ")  // never the rest: it may hold Roberto's text
        do { try process.run() } catch {
            log("\(name) not started: \(error)")
            return .failure(.notStarted)
        }
        // stderr on its own thread, so a chatty stderr never blocks the stdout read.
        let box = Box(), drained = DispatchSemaphore(value: 0)
        DispatchQueue.global().async { box.data = err.fileHandleForReading.readDataToEndOfFile(); drained.signal() }
        let data = out.fileHandleForReading.readDataToEndOfFile()
        drained.wait()
        process.waitUntilExit()
        let stderr = String(decoding: box.data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
        guard process.terminationStatus == 0 else {
            log("\(name) exit \(process.terminationStatus) stderr: \(stderr.suffix(2000))")
            return .failure(.exit(status: process.terminationStatus, stderr: stderr))
        }
        return .success(data)
    }

    public static func defaultLog(_ line: String) {
        #if canImport(os)
        Logger(subsystem: ClotchLog.subsystem, category: "EngineCommand").error("\(line, privacy: .public)")
        #else
        FileHandle.standardError.write(Data(("EngineCommand: " + line + "\n").utf8))
        #endif
    }

    private final class Box: @unchecked Sendable { var data = Data() }  // the semaphore orders the write before the read
}
