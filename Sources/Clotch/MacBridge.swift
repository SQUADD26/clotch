import Foundation
import Network
import os.log
import ClotchCore

private let log = Logger(subsystem: ClotchLog.subsystem, category: "MacBridge")

/// The engine's door to the Mac UI (clotch#283). Scripts in claude-config (dai-ok,
/// apri-master) used to run osascript and the AX helper themselves, as python3.x:
/// macOS asked for Accessibility/Automation again at every new interpreter.
/// Here Clotch runs them as its own children, and macOS attributes a child's
/// permissions to its responsible process, Clotch: one grant, one app.
///
/// Protocol: one JSON request per connection, `{"argv": [...], "timeout": s}`,
/// client half-closes; reply `{"code": n, "out": "...", "err": "..."}`.
/// `code` -1 = refused (program not allowed, bad request, timeout).
/// Socket mode 0700 like HookServer's; only the programs below may run.
@MainActor
final class MacBridge {
    static let shared = MacBridge()

    nonisolated static var socketPath: String {
        ProcessInfo.processInfo.environment["CLOTCH_MAC_SOCKET_PATH"] ?? "/tmp/clotch-mac-\(getuid()).sock"
    }

    nonisolated static var allowed: Set<String> {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        return ["/usr/bin/osascript", "/usr/sbin/screencapture", home + "/.cache/apri-master/ax-premi", home + "/.cache/chat-ferme/ax-chat-ferme"]
    }

    private var listener: NWListener?
    private let path: String
    private let allowedPrograms: Set<String>

    init(path: String = MacBridge.socketPath, allowed: Set<String> = MacBridge.allowed) {
        self.path = path
        allowedPrograms = allowed
    }

    func start() {
        unlink(path)
        let previousUmask = umask(0o077)
        let params = NWParameters()
        params.defaultProtocolStack.transportProtocol = NWProtocolTCP.Options()
        params.requiredLocalEndpoint = NWEndpoint.unix(path: path)
        do {
            listener = try NWListener(using: params)
        } catch {
            umask(previousUmask)
            log.error("MacBridge: \(error.localizedDescription)")
            return
        }
        listener?.newConnectionHandler = { [weak self] connection in
            connection.start(queue: .main)
            Task { @MainActor in self?.receive(connection, Data()) }
        }
        listener?.stateUpdateHandler = { [path, previousUmask] state in
            switch state {
            case .ready:
                umask(previousUmask)
                chmod(path, 0o700)
            case .failed(let error):
                umask(previousUmask)
                log.error("MacBridge failed: \(error.localizedDescription)")
            default: break
            }
        }
        listener?.start(queue: .main)
    }

    func stop() {
        listener?.cancel()
        listener = nil
        unlink(path)
    }

    private func receive(_ connection: NWConnection, _ accumulated: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] content, _, isComplete, error in
            Task { @MainActor in
                guard let self else { return }
                var data = accumulated
                if let content { data.append(content) }
                if data.count > 1_048_576 { return connection.cancel() }
                if isComplete || error != nil {
                    let allowed = self.allowedPrograms
                    DispatchQueue.global(qos: .userInitiated).async {
                        let reply = MacBridge.handle(data, allowed: allowed)
                        connection.send(content: reply, completion: .contentProcessed { _ in connection.cancel() })
                    }
                } else {
                    self.receive(connection, data)
                }
            }
        }
    }

    nonisolated static func handle(_ request: Data, allowed: Set<String>) -> Data {
        let result: (Int32, String, String)
        if let obj = try? JSONSerialization.jsonObject(with: request) as? [String: Any],
           let argv = obj["argv"] as? [String], let program = argv.first {
            if allowed.contains(program) {
                result = run(argv, timeout: (obj["timeout"] as? Double) ?? 30)
            } else {
                result = (-1, "", "programma non ammesso dal ponte di Clotch: \(program)")
            }
        } else {
            result = (-1, "", "richiesta non valida: serve {\"argv\": [...]}")
        }
        let reply: [String: Any] = ["code": result.0, "out": result.1, "err": result.2]
        return (try? JSONSerialization.data(withJSONObject: reply)) ?? Data()
    }

    private final class Box: @unchecked Sendable { var data = Data() }

    nonisolated static func run(_ argv: [String], timeout: TimeInterval) -> (Int32, String, String) {
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: argv[0])
        proc.arguments = Array(argv.dropFirst())
        let outPipe = Pipe(), errPipe = Pipe()
        proc.standardOutput = outPipe
        proc.standardError = errPipe
        proc.standardInput = FileHandle.nullDevice
        let exited = DispatchSemaphore(value: 0)
        proc.terminationHandler = { _ in exited.signal() }
        do { try proc.run() } catch { return (-1, "", "avvio fallito: \(error.localizedDescription)") }
        // Drain both pipes in the background so a full buffer cannot wedge the child.
        let out = Box(), err = Box(), drained = DispatchGroup()
        for (pipe, box) in [(outPipe, out), (errPipe, err)] {
            DispatchQueue.global().async(group: drained) { box.data = pipe.fileHandleForReading.readDataToEndOfFile() }
        }
        if exited.wait(timeout: .now() + timeout) == .timedOut {
            proc.terminate()
            if exited.wait(timeout: .now() + 1) == .timedOut { kill(proc.processIdentifier, SIGKILL) }
            _ = drained.wait(timeout: .now() + 1)
            return (-1, "", "scaduto dopo \(Int(timeout)) s")
        }
        _ = drained.wait(timeout: .now() + 1)
        return (proc.terminationStatus, String(decoding: out.data, as: UTF8.self), String(decoding: err.data, as: UTF8.self))
    }
}
