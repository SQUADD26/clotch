import Foundation
import ClotchCore

/// A spoken question (#110): `claude -p` with Haiku and read-only tools, the question on stdin. nil = no answer (no `claude`,
/// error, or `timeout` seconds passed).
enum VoiceAsk {
    static let timeout: TimeInterval = 45

    static func run(_ question: String) async -> String? {
        await Task.detached { () -> String? in
            guard let bin = VoiceSpeaker.claudeBinary() else { return nil }
            let p = Process()
            p.executableURL = URL(fileURLWithPath: bin)
            p.arguments = VoiceRoute.askArguments()
            p.currentDirectoryURL = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".claude")
            var env = ProcessInfo.processInfo.environment
            env["CLOTCH_VOCE_INTERNA"] = "1"  // the Stop hook skips Clotch's own call
            p.environment = env
            let stdin = Pipe(), stdout = Pipe()
            p.standardInput = stdin
            p.standardOutput = stdout
            p.standardError = FileHandle.nullDevice
            guard (try? p.run()) != nil else { return nil }
            stdin.fileHandleForWriting.write(Data(VoiceRoute.askInput(question).utf8))
            try? stdin.fileHandleForWriting.close()
            let timer = DispatchWorkItem { p.terminate() }
            DispatchQueue.global().asyncAfter(deadline: .now() + timeout, execute: timer)
            let out = stdout.fileHandleForReading.readDataToEndOfFile()
            p.waitUntilExit()
            timer.cancel()
            let text = String(decoding: out, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
            return p.terminationStatus == 0 && !text.isEmpty ? text : nil
        }.value
    }
}
