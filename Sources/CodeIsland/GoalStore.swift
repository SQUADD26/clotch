import Foundation
import Combine
import CoreServices
import CodeIslandCore

private typealias GoalDiskData = GoalLoader.Snapshot

/// Watches the goal register, the live-state folder, Claude Desktop's session store and the requests
/// folder with one
/// FSEventStream and reloads them off the main thread, coalesced to one load per `coalesce`. The desktop
/// apps rewrite session files every minute and hooks write live files on every tool call: each load
/// touches only the paths the events named (`GoalLoader`), and at most one load runs or waits at a time.
/// Read-only: it never creates a directory; a missing one just means no data, and its nearest
/// existing ancestor is watched so the data shows up once the directory is created.
/// All mutable state is confined to `queue`.
private final class GoalWatcher: @unchecked Sendable {
    private let queue = DispatchQueue(label: "goal.store.watcher", qos: .utility)
    private let home: URL
    private let onLoad: @Sendable (GoalDiskData) -> Void
    private let coalesce: TimeInterval = 1
    private let loader: GoalLoader
    private var support = ""
    private var stream: FSEventStreamRef?
    private var pending: DispatchWorkItem?
    /// Paths named by file events since the last load; nil = the next load rescans everything.
    private var changed: Set<String>? = nil
    private var prefixes: [String] = []

    init(home: URL, onLoad: @escaping @Sendable (GoalDiskData) -> Void) {
        self.home = home
        loader = GoalLoader(home: home)
        self.onLoad = onLoad
    }

    func start() {
        queue.async { [self] in
            guard stream == nil else { return }
            let paths = loader.paths
            let support = home.appendingPathComponent("Library/Application Support")
            self.support = support.resolvingSymlinksInPath().path
            // FSEvents reports resolved paths (/private/var…), so match both spellings.
            prefixes = [paths.goals, paths.live, paths.requests].flatMap { [$0.path, $0.resolvingSymlinksInPath().path] }
            let roots = Array(Set([paths.goals, paths.live, paths.requests, support].map { Self.existingAncestor($0).path }))

            var context = FSEventStreamContext(version: 0, info: Unmanaged.passUnretained(self).toOpaque(),
                                               retain: nil, release: nil, copyDescription: nil)
            // C function pointer: no captures, state comes back through `info`.
            let callback: FSEventStreamCallback = { _, info, count, eventPaths, eventFlags, _ in
                guard let info else { return }
                let watcher = Unmanaged<GoalWatcher>.fromOpaque(info).takeUnretainedValue()
                let list = (unsafeBitCast(eventPaths, to: NSArray.self) as? [String]) ?? []
                let lost = FSEventStreamEventFlags(kFSEventStreamEventFlagMustScanSubDirs
                    | kFSEventStreamEventFlagUserDropped | kFSEventStreamEventFlagKernelDropped)
                let rescan = (0..<count).contains { eventFlags[$0] & lost != 0 }
                watcher.handle(list, rescan: rescan)
            }
            guard let created = FSEventStreamCreate(
                nil, callback, &context, roots as CFArray,
                // No NoDefer: FSEvents itself batches a burst into one callback `coalesce` after its first event,
                // so foreign writes under Application Support wake this queue at most once a second.
                FSEventStreamEventId(kFSEventStreamEventIdSinceNow), coalesce,
                FSEventStreamCreateFlags(kFSEventStreamCreateFlagUseCFTypes | kFSEventStreamCreateFlagFileEvents)
            ) else { return }
            FSEventStreamSetDispatchQueue(created, queue)
            FSEventStreamStart(created)
            stream = created
            schedule()  // first load
        }
    }

    private func handle(_ paths: [String], rescan: Bool) {
        let hits = paths.filter { path in
            path.contains("claude-code-sessions") || prefixes.contains { path.hasPrefix($0) }
        }
        // A new Claude app folder (another account) brings a session store the loader does not know yet.
        // String checks only: foreign apps write under Application Support all the time.
        let newRoot = paths.contains { p in
            guard p.hasPrefix(support + "/") else { return false }
            var name = p.dropFirst(support.count + 1)
            if name.hasSuffix("/") { name = name.dropLast() }
            return !name.contains("/") && name.lowercased().hasPrefix("claude")
        }
        if rescan || newRoot { changed = nil } else { changed?.formUnion(hits) }
        if rescan || newRoot || !hits.isEmpty {
            schedule()
        }
    }

    /// One load per batch of events (the stream already waits `coalesce`); batches arriving meanwhile ride on it.
    /// FSEvents are delivered on `queue` too, so none arrives while a load runs: never two at once.
    private func schedule() {
        guard pending == nil else { return }
        let item = DispatchWorkItem { [self] in
            let paths = changed
            changed = []
            if let snap = loader.load(changed: paths) { onLoad(snap) }
            pending = nil
        }
        pending = item
        queue.async(execute: item)
    }

    /// Read on the loader's own queue (the loader is not thread-safe).
    func allSessions(_ done: @escaping @Sendable ([DesktopSession]) -> Void) {
        queue.async { [self] in done(loader.allSessions) }
    }

    private static func existingAncestor(_ url: URL) -> URL {
        var u = url
        while u.path != "/", !FileManager.default.fileExists(atPath: u.path) { u = u.deletingLastPathComponent() }
        return u
    }

    deinit {
        pending?.cancel()
        if let stream {
            FSEventStreamStop(stream)
            FSEventStreamInvalidate(stream)
            FSEventStreamRelease(stream)
        }
    }
}

/// Live source of truth for the goal notch: `rows` is `GoalBoard.rows` over what is on disk right now.
@MainActor final class GoalStore: ObservableObject {
    static let shared = GoalStore()

    @Published private(set) var rows: [GoalRow] = []
    /// Newest first; empty until the Overseer writes ~/.claude/richieste.
    @Published private(set) var requests: [UserRequest] = []
    /// Requests that just went nuova -> presa/fatta, oldest first. The view plays «presa in carico» once
    /// for each, then calls `takenAnimationShown(id)`; a shown id never comes back while the app runs.
    @Published private(set) var takenToAnimate: [String] = []
    private var takenShown: Set<String> = []
    /// False until ~/.claude/richieste exists (the register ships with a config promotion): the view
    /// then says the section is not active yet instead of «no requests».
    @Published private(set) var requestsFolderExists = false
    private var requestsLoaded = false
    /// Refreshed only when the board changes, so an idle board never redraws. The open notch ticks
    /// its own "since …" text (TimelineView); `--snapshot` reads this.
    @Published private(set) var now: Date = Date()
    /// Proposals Roberto rejected in the notch (`GoalDecision.key`): hidden here at once, whether or not the
    /// register took the refusal (#20). A new proposal text from the same session shows again.
    @Published private(set) var rejected = Set(UserDefaults.standard.stringArray(forKey: GoalStore.rejectedKey) ?? [])
    @Published private(set) var accepting: Set<String> = []
    @Published private(set) var acceptFailed: Set<String> = []
    private nonisolated static let rejectedKey = "goalnotch.rejectedProposals"

    private var goalPRs: [String: [SessionPR]] = [:]  // handed to `PullRequestFeed`, which publishes the open ones
    private var snapshot: GoalDiskData = ([], [], [], [])
    private var watcher: GoalWatcher?
    /// One-shot, at `GoalBoard.nextChange`: the only time the board is rebuilt without a change on disk.
    private var deadline: Timer?

    func start() {
        guard watcher == nil else { return }
        let w = GoalWatcher(home: FileManager.default.homeDirectoryForCurrentUser) { [weak self] snap in
            Task { @MainActor in self?.apply(snap) }
        }
        watcher = w
        w.start()
    }

    /// Every session of the Claude apps, for the voice (#50); empty before `start()`.
    func allSessions() async -> [DesktopSession] {
        guard let watcher else { return [] }
        return await withCheckedContinuation { c in watcher.allSessions { c.resume(returning: $0) } }
    }

    /// One synchronous read of the disk, for `--snapshot` (no watcher, no deadline).
    func loadNow() {
        apply(GoalSources.load(GoalSources.defaultPaths(home: FileManager.default.homeDirectoryForCurrentUser)))
    }

    private func apply(_ snap: GoalDiskData) {
        snapshot = snap
        let fresh = UserRequest.newlyTaken(before: requestsLoaded ? requests : nil, after: snap.requests,
                                           shown: takenShown.union(takenToAnimate))
        requestsLoaded = true
        let exists = FileManager.default.fileExists(atPath: FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".claude/richieste").path)
        if exists != requestsFolderExists { requestsFolderExists = exists }
        if !fresh.isEmpty { takenToAnimate += fresh }
        if snap.requests != requests { requests = snap.requests }
        VoiceAlertCenter.shared.registersLoaded(goals: snap.goals, requests: snap.requests)
        let prs = PullRequests.byGoal(goals: snap.goals, sessions: snap.sessions)
        if prs != goalPRs { goalPRs = prs; PullRequestFeed.shared.track(prs) }
        refresh()
    }

    func reject(_ row: GoalRow) {
        guard let text = row.proposal else { return }
        rejected.insert(GoalDecision.key(cli: row.id, text: text))
        UserDefaults.standard.set(rejected.sorted(), forKey: Self.rejectedKey)
        if let args = GoalDecision.rejectArguments(row, home: FileManager.default.homeDirectoryForCurrentUser.path) {
            Task.detached { _ = Self.python(args) }
        }
    }

    /// Roberto's «sì» from the notch: `obiettivo-guard.py conferma`, off the main thread. On success the watcher
    /// sees the register change and the goal moves among the confirmed ones.
    func accept(_ row: GoalRow) {
        guard let args = GoalDecision.acceptArguments(row, home: FileManager.default.homeDirectoryForCurrentUser.path),
              accepting.insert(row.id).inserted else { return }
        acceptFailed.remove(row.id)
        Task.detached {
            let ok = Self.python(args)
            await MainActor.run {
                self.accepting.remove(row.id)
                if !ok { self.acceptFailed.insert(row.id) }
            }
        }
    }

    private nonisolated static func python(_ args: [String]) -> Bool {
        guard let py = ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"]
            .first(where: FileManager.default.isExecutableFile(atPath:)) else { return false }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: py)
        process.arguments = args
        var env = ProcessInfo.processInfo.environment
        env["CLAUDE_CODE_SESSION_ID"] = nil  // Roberto, not a master: with it the command refuses (exit 3)
        process.environment = env
        process.standardInput = FileHandle.nullDevice  // a mode obiettivo-guard.py does not know yet reads stdin as a hook
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        guard (try? process.run()) != nil else { return false }
        process.waitUntilExit()
        return process.terminationStatus == 0
    }

    func takenAnimationShown(_ id: String) {
        takenShown.insert(id)
        takenToAnimate.removeAll { $0 == id }
    }

    private func refresh() {
        let t = Date()
        let next = GoalBoard.rows(goals: snapshot.goals, sessions: snapshot.sessions, live: snapshot.live, now: t)
        deadline?.invalidate()
        deadline = nil
        if watcher != nil, let at = GoalBoard.nextChange(goals: snapshot.goals, sessions: snapshot.sessions, live: snapshot.live, now: t) {
            let d = Timer(fire: at.addingTimeInterval(1), interval: 0, repeats: false) { [weak self] _ in
                Task { @MainActor in self?.refresh() }
            }
            d.tolerance = 5
            RunLoop.main.add(d, forMode: .common)
            deadline = d
        }
        guard next != rows else { return }
        now = t
        rows = next
    }
}
