import Foundation
import ClotchCore

/// Why a read of the questions failed: the sentence the tab shows (#158, claude-config#1967). Never «Nessuna domanda».
struct AdhdFailure: Error, Equatable, Sendable {
    let message: String

    /// The command ran and exited with `status`: the last line of its stderr says why.
    static func exit(_ status: Int32, stderr: String) -> AdhdFailure {
        let last = stderr.split(whereSeparator: \.isNewline).last.map { $0.trimmingCharacters(in: .whitespaces) } ?? ""
        return AdhdFailure(message: "Il comando delle richieste è uscito con errore \(status)" + (last.isEmpty ? "" : ": «\(last)»") + ". Riprova tra poco.")
    }
    static let notStarted = AdhdFailure(message: "Il comando delle richieste non è partito: manca python3. Riprova tra poco.")
    static let unreadable = AdhdFailure(message: "La risposta del comando delle richieste non si legge. Riprova tra poco.")
}

/// The ADHD tab's data: `richieste.py adhd` (claude-config#1927), read while the notch is open: on opening and every 10 s.
/// «Sollecita» goes back through the same command, the list changes at once, the next read confirms it. «Rimuovi» (`letta`)
/// takes the rows out at once but runs the command only after `grace` s, with «Annulla» on screen (#158).
@MainActor
final class AdhdStore: ObservableObject {
    typealias Runner = @Sendable ([String]) -> Result<Data, AdhdFailure>
    /// Answers taken out of the list, the list before, and the seconds left to take them back.
    struct Removal { let rows: [AdhdRequest]; let before: [AdhdRequest]; var left: Int }

    static let shared = AdhdStore()
    @Published var items: [AdhdRequest] = []
    /// Set when the last read failed: the tab shows it in place of the list. A good read clears it.
    @Published var failure: AdhdFailure?
    /// The question another session asked to see open: the pointer entering another row, or the notch closing, clears it.
    @Published var focus: String?
    @Published private(set) var removal: Removal?
    private var timer: Timer?
    private var reading = false
    private var countdown: Task<Void, Never>?
    private let home = FileManager.default.homeDirectoryForCurrentUser.path
    private let grace: TimeInterval
    private let run: Runner

    init(grace: TimeInterval = 3, run: @escaping Runner = AdhdStore.run) { self.grace = grace; self.run = run }

    var unanswered: Int { AdhdRequest.unansweredCount(items) }

    func show(question: String) { focus = question }

    func start() {
        refresh()
        guard timer == nil else { return }
        timer = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.refresh() }
        }
    }

    func stop() { timer?.invalidate(); timer = nil; focus = nil }

    func refresh() {
        guard !reading else { return }
        reading = true
        let args = [home + "/.claude/hooks/richieste.py", "adhd"], run = run
        Task.detached {
            let read = run(args).flatMap { data -> Result<[AdhdRequest], AdhdFailure> in
                (try? JSONSerialization.jsonObject(with: data)) is [Any] ? .success(GoalSources.parseAdhd(data)) : .failure(.unreadable)
            }
            await MainActor.run {
                self.reading = false
                switch read {
                case .success(let list):
                    self.failure = nil
                    let held = Set(self.removal?.rows.map(\.id) ?? [])  // still waiting for their «letta»: not back yet
                    let shown = list.filter { !held.contains($0.id) }
                    if shown != self.items { self.items = shown }
                case .failure(let error): self.failure = error
                }
            }
        }
    }

    /// One answered question, or all of them with nil: out of the list now, `letta` after `grace` s unless `undoRemoval` comes first.
    func markRead(_ id: String?) {
        commitRemoval()
        let rows = items.filter { $0.answered && (id == nil || $0.id == id) }
        guard !rows.isEmpty else { return }
        removal = Removal(rows: rows, before: items, left: Int(grace.rounded(.up)))
        items.removeAll { r in rows.contains { $0.id == r.id } }
        countdown = Task {
            var left = grace
            while left > 0 {
                removal?.left = Int(left.rounded(.up))
                let step = min(1, left)
                try? await Task.sleep(for: .seconds(step))
                if Task.isCancelled { return }
                left -= step
            }
            commitRemoval()
        }
    }

    /// «Annulla»: the rows come back, no command runs.
    func undoRemoval() {
        guard let removal else { return }
        countdown?.cancel()
        self.removal = nil
        items = removal.before
        refresh()
    }

    /// The grace is over (or another removal starts): now the command really runs.
    private func commitRemoval() {
        guard let done = removal else { return }
        countdown?.cancel()
        removal = nil
        let commands = AdhdRequest.markReadArguments(nil, in: done.rows, home: home), run = run
        Task.detached {
            for args in commands { _ = run(args) }
            await MainActor.run { self.refresh() }
        }
    }

    func nudge(_ id: String) {
        if let i = items.firstIndex(where: { $0.id == id }) { items[i].nudged = true }
        act("sollecita", id)
    }

    private func act(_ verb: String, _ arg: String) {
        let args = [home + "/.claude/hooks/richieste.py", verb, arg], run = run
        Task.detached {
            _ = run(args)
            await MainActor.run { self.refresh() }
        }
    }

    /// stdout of the script; the failure says how it went wrong, with the last line of its stderr.
    nonisolated static func run(_ args: [String]) -> Result<Data, AdhdFailure> {
        guard let py = ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"]
            .first(where: FileManager.default.isExecutableFile(atPath:)) else { return .failure(.notStarted) }
        let process = Process(), out = Pipe(), err = Pipe()
        process.executableURL = URL(fileURLWithPath: py)
        process.arguments = args
        var env = ProcessInfo.processInfo.environment
        env["CLAUDE_CODE_SESSION_ID"] = nil  // Roberto, not a session: with it the command may refuse
        process.environment = env
        process.standardInput = FileHandle.nullDevice
        process.standardOutput = out
        process.standardError = err
        guard (try? process.run()) != nil else { return .failure(.notStarted) }
        // shortcut: stdout is drained before stderr; a script writing 64 KB of stderr first would stall, not seen with richieste.py.
        let data = out.fileHandleForReading.readDataToEndOfFile()
        let stderr = String(decoding: err.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
        process.waitUntilExit()
        return process.terminationStatus == 0 ? .success(data) : .failure(.exit(process.terminationStatus, stderr: stderr))
    }
}
