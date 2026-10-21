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
        let newRoot = paths.contains { p in
            let u = URL(fileURLWithPath: p)
            return u.deletingLastPathComponent().path == support && u.lastPathComponent.lowercased().hasPrefix("claude")
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
    /// Requests just arrived (nuova) or just taken in charge (nuova -> presa/fatta), oldest first. The notch
    /// plays each once, then calls `requestNewsShown(_:)`; a shown one never comes back while the app runs.
    @Published private(set) var requestNews: [NotchEvent] = []
    /// Requests whose «presa in carico» was played or is queued: never twice.
    private var takenAnnounced: Set<String> = []
    /// False until ~/.claude/richieste exists (the register ships with a config promotion): the view
    /// then says the section is not active yet instead of «no requests».
    @Published private(set) var requestsFolderExists = false
    private var requestsLoaded = false
    /// Refreshed when the board changes and every 30 s tick; views compute "since …" against this.
    /// Never on a reload that changed nothing, so an idle board never redraws.
    @Published private(set) var now: Date = Date()

    private var snapshot: GoalDiskData = ([], [], [], [])
    private var watcher: GoalWatcher?
    private var timer: Timer?

    func start() {
        guard watcher == nil else { return }
        let w = GoalWatcher(home: FileManager.default.homeDirectoryForCurrentUser) { [weak self] snap in
            Task { @MainActor in self?.apply(snap) }
        }
        watcher = w
        w.start()
        // Time alone turns a goal yellow (30 min idle), so re-evaluate even when nothing changes on disk.
        let t = Timer(timeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.refresh(tick: true) }
        }
        t.tolerance = 5
        RunLoop.main.add(t, forMode: .common)
        timer = t
    }

    /// One synchronous read of the disk, for `--snapshot` (no watcher, no timer).
    func loadNow() {
        apply(GoalSources.load(GoalSources.defaultPaths(home: FileManager.default.homeDirectoryForCurrentUser)))
    }

    private func apply(_ snap: GoalDiskData) {
        snapshot = snap
        let before = requestsLoaded ? requests : nil
        let taken = UserRequest.newlyTaken(before: before, after: snap.requests, shown: takenAnnounced)
        takenAnnounced.formUnion(taken)
        let fresh = UserRequest.newlyArrived(before: before, after: snap.requests).map { NotchEvent(kind: .requestArrived, subject: $0, count: 0) }
            + taken.map { NotchEvent(kind: .requestTaken, subject: $0, count: 0) }
        requestsLoaded = true
        let exists = FileManager.default.fileExists(atPath: FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".claude/richieste").path)
        if exists != requestsFolderExists { requestsFolderExists = exists }
        if !fresh.isEmpty { requestNews += fresh }
        if snap.requests != requests { requests = snap.requests }
        refresh()
    }

    func requestNewsShown(_ event: NotchEvent) {
        requestNews.removeAll { $0 == event }
    }

    private func refresh(tick: Bool = false) {
        let t = Date()
        let next = GoalBoard.rows(goals: snapshot.goals, sessions: snapshot.sessions, live: snapshot.live, now: t)
        guard tick || next != rows else { return }
        now = t
        if next != rows { rows = next }
    }
}
