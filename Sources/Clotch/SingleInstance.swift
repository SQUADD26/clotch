import AppKit
import os.log
import ClotchCore

/// One Clotch per Mac (#144). Carbon `RegisterEventHotKey` returns noErr even when another process
/// already owns the combination, so two copies fight for the shortcut silently. The newer copy
/// closes the others and takes their place: a new build replaces the old one, whatever folder it runs from.
enum SingleInstance {
    nonisolated private static let log = Logger(subsystem: ClotchLog.subsystem, category: "SingleInstance")

    struct Proc: Equatable {
        let pid: pid_t
        let bundleID: String?
    }

    /// Pure decision: the pids of the other copies (same bundle id, not us).
    static func pidsToClose(ownPID: pid_t, ownBundleID: String?, running: [Proc]) -> [pid_t] {
        guard let ownBundleID else { return [] }
        return running.filter { $0.bundleID == ownBundleID && $0.pid != ownPID }.map(\.pid)
    }

    /// Asks the other copies to quit, waits up to `timeout` seconds, then force-quits the stubborn ones.
    @MainActor
    static func replaceOthers(timeout: TimeInterval = 3) {
        guard let id = Bundle.main.bundleIdentifier else { return }
        let others = NSRunningApplication.runningApplications(withBundleIdentifier: id)
        let pids = Set(pidsToClose(ownPID: ProcessInfo.processInfo.processIdentifier, ownBundleID: id,
                                   running: others.map { Proc(pid: $0.processIdentifier, bundleID: $0.bundleIdentifier) }))
        let victims = others.filter { pids.contains($0.processIdentifier) }
        guard !victims.isEmpty else { return }
        log.info("closing \(victims.count) other Clotch copies")
        victims.forEach { $0.terminate() }
        let deadline = Date().addingTimeInterval(timeout)
        while victims.contains(where: { !$0.isTerminated }) && Date() < deadline {
            RunLoop.current.run(until: Date().addingTimeInterval(0.05))
        }
        for v in victims where !v.isTerminated {
            log.warning("forcing quit of pid \(v.processIdentifier)")
            v.forceTerminate()
        }
    }
}
