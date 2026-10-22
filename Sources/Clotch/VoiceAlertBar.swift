import Foundation
import os.log
import ClotchCore

/// What the voice says stays written (#235, #236): the line under the closed notch while it speaks and 8 s after (the pointer on it
/// keeps it), and, in the open notch, the oks and the stuck sessions still waiting for Roberto. «Dai l’ok» runs claude-config's
/// `dai-ok` (#1982), never a copy of it.
@MainActor
final class VoiceAlertBar: ObservableObject {
    static let shared = VoiceAlertBar()
    private static let log = Logger(subsystem: "com.squadd.clotch", category: "Voice")

    enum State: Equatable { case shown, sending, done, failed(String) }

    @Published private(set) var current: VoiceEvent?
    @Published private(set) var state: State = .shown
    /// `aspetta_ok` and `dipendenza_ferma` not handled yet, newest first.
    @Published private(set) var waiting: [VoiceEvent] = []
    /// The event whose ok failed, and why.
    var failure: (VoiceEvent, String)? { if case .failed(let r) = state, let current { return (current, r) } else { return nil } }
    var pointerOver = false { didSet { if oldValue && !pointerOver { hide(after: Self.hold) } } }

    static let hold: TimeInterval = 8
    /// shortcut: an event older than this leaves the open notch by itself (the engine writes no «handled» line); dai-ok's own window.
    static let keep: TimeInterval = 2 * 3600
    /// The tests swap it: python3 + args → exit code and stdout.
    static var run: @Sendable ([String]) -> (Int32, String) = { python($0) }

    private var hideTask: Task<Void, Never>?

    /// Every new line of eventi.jsonl: the ones that wait on Roberto are kept for the open notch.
    func remember(_ events: [VoiceEvent], now: Date = Date()) {
        for e in events where [.waitsForOk, .stalledDependency].contains(e.kind) {
            waiting.removeAll { $0.kind == e.kind && VoiceAlertText($0)?.localId == VoiceAlertText(e)?.localId }
            waiting.insert(e, at: 0)
        }
        waiting.removeAll { now.timeIntervalSince($0.at) > Self.keep }
    }

    /// The voice starts saying `e`: its line comes up under the notch.
    func speaking(_ e: VoiceEvent) {
        guard VoiceAlertText(e) != nil else { return }
        hideTask?.cancel()
        current = e
        state = .shown
        if e.kind == .adhdAnswer { AdhdStore.shared.refresh() }  // the whole question and answer, not the cut `soggetto`
    }

    /// The voice is done with `e`: the line stays `hold` seconds more.
    func spoke(_ e: VoiceEvent) {
        guard current == e else { return }
        hide(after: Self.hold)
    }

    func hide(after seconds: TimeInterval) {
        hideTask?.cancel()
        hideTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            guard let self, !Task.isCancelled, !self.pointerOver, self.state != .sending else { return }
            if case .failed = self.state { return }  // an error stays until Roberto acts on it
            self.current = nil
        }
    }

    /// «Dai l’ok» / «Riprova»: `dai-ok --evento <id> <local_id>`. Exit 0 = the ok went in as Roberto; otherwise its reason.
    func giveOk(_ e: VoiceEvent) {
        guard let t = VoiceAlertText(e), !t.localId.isEmpty else { return }
        hideTask?.cancel()
        current = e
        state = .sending
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        var args = [home + "/.claude/hooks/dai_ok.py"]
        if !e.id.isEmpty { args += ["--evento", e.id] }
        args.append(t.localId)
        let run = Self.run
        Task {
            let (code, out) = await Task.detached { run(args) }.value
            let reason = Self.reason(code: code, stdout: out)
            Self.log.info("dai-ok \(t.localId, privacy: .public): exit \(code) \(reason ?? "ok", privacy: .public)")
            guard current == e else { return }
            if let reason {
                state = .failed(reason)
            } else {
                state = .done
                waiting.removeAll { $0 == e }
                hide(after: 2)
            }
        }
    }

    /// «Apri chat»: the session in the copy of the Claude app that owns it.
    func openChat(_ e: VoiceEvent) {
        guard let id = VoiceAlertText(e)?.localId, !id.isEmpty else { return }
        dismiss()
        Task {
            let profile = await GoalStore.shared.allSessions().first { $0.localId == id }?.profile ?? ""
            SessionOpener.open(SessionTarget(localId: id, profile: profile))
        }
    }

    /// The line goes once Roberto acted elsewhere (opened the chat, the ADHD tab).
    func dismiss() {
        hideTask?.cancel()
        current = nil
        state = .shown
    }

    /// nil = done; else the last line dai-ok printed, without its «dai-ok:» prefix.
    nonisolated static func reason(code: Int32, stdout: String) -> String? {
        guard code != 0 else { return nil }
        var last = stdout.split(separator: "\n").last.map(String.init)?.trimmingCharacters(in: .whitespaces) ?? ""
        if last.hasPrefix("dai-ok: ") { last.removeFirst("dai-ok: ".count) }
        return last.isEmpty ? "dai-ok è uscito con errore \(code)." : last
    }

    private nonisolated static func python(_ args: [String]) -> (Int32, String) {
        guard let py = ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"]
            .first(where: FileManager.default.isExecutableFile(atPath:)) else { return (127, "python3 non trovato.") }
        let process = Process(), out = Pipe()
        process.executableURL = URL(fileURLWithPath: py)
        process.arguments = args
        var env = ProcessInfo.processInfo.environment
        env["CLAUDE_CODE_SESSION_ID"] = nil  // Roberto, not a session
        process.environment = env
        process.standardInput = FileHandle.nullDevice
        process.standardOutput = out
        process.standardError = FileHandle.nullDevice
        guard (try? process.run()) != nil else { return (126, "dai-ok non parte.") }
        let data = out.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        return (process.terminationStatus, String(decoding: data, as: UTF8.self))
    }
}
