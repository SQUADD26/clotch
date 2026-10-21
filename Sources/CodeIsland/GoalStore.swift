import Foundation
import Combine
import CoreServices
import CodeIslandCore

private typealias GoalDiskData = (goals: [GoalRecord], sessions: [DesktopSession], live: [LiveState],
                                  usage: [AccountUsage], requests: [UserRequest])

/// Watches the goal register, the live-state folder, Claude Desktop's session store, the account usage
/// cache and the requests folder with one
/// FSEventStream and reloads them off the main thread, coalesced to one load per `coalesce`.
/// Read-only: it never creates a directory; a missing one just means no data, and its nearest
/// existing ancestor is watched so the data shows up once the directory is created.
/// All mutable state is confined to `queue`.
private final class GoalWatcher: @unchecked Sendable {
    private let queue = DispatchQueue(label: "goal.store.watcher", qos: .utility)
    private let home: URL
    private let onLoad: @Sendable (GoalDiskData) -> Void
    private let coalesce: TimeInterval = 0.15
    private var stream: FSEventStreamRef?
    private var pending: DispatchWorkItem?
    private var prefixes: [String] = []

    init(home: URL, onLoad: @escaping @Sendable (GoalDiskData) -> Void) {
        self.home = home
        self.onLoad = onLoad
    }

    func start() {
        queue.async { [self] in
            guard stream == nil else { return }
            let paths = GoalSources.defaultPaths(home: home)
            let support = home.appendingPathComponent("Library/Application Support")
            // FSEvents reports resolved paths (/private/var…), so match both spellings.
            prefixes = [paths.goals, paths.live, paths.usage, paths.requests].flatMap { [$0.path, $0.resolvingSymlinksInPath().path] }
            let roots = Array(Set([paths.goals, paths.live, paths.usage, paths.requests, support].map { Self.existingAncestor($0).path }))

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
                FSEventStreamEventId(kFSEventStreamEventIdSinceNow), 0.05,
                FSEventStreamCreateFlags(kFSEventStreamCreateFlagUseCFTypes
                    | kFSEventStreamCreateFlagFileEvents | kFSEventStreamCreateFlagNoDefer)
            ) else { return }
            FSEventStreamSetDispatchQueue(created, queue)
            FSEventStreamStart(created)
            stream = created
            schedule()  // first load
        }
    }

    private func handle(_ paths: [String], rescan: Bool) {
        let hit = paths.contains { path in
            path.contains("claude-code-sessions") || prefixes.contains { path.hasPrefix($0) }
        }
        if rescan || hit {
            schedule()
        }
    }

    /// The first event of a burst arms one load `coalesce` later; events arriving meanwhile ride on it.
    private func schedule() {
        guard pending == nil else { return }
        let item = DispatchWorkItem { [self] in
            pending = nil
            onLoad(GoalSources.load(GoalSources.defaultPaths(home: home)))
        }
        pending = item
        queue.asyncAfter(deadline: .now() + coalesce, execute: item)
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
    /// One per account, sorted by id; empty until claude_accounts_uso.py has written the cache.
    @Published private(set) var usage: [AccountUsage] = []
    /// Newest first; empty until the Overseer writes ~/.claude/richieste.
    @Published private(set) var requests: [UserRequest] = []
    /// Requests that just went nuova -> presa/fatta, oldest first. The view plays «presa in carico» once
    /// for each, then calls `takenAnimationShown(id)`; a shown id never comes back while the app runs.
    @Published private(set) var takenToAnimate: [String] = []
    private var takenShown: Set<String> = []
    private var requestsLoaded = false
    /// Refreshed on every reload and every 30 s tick; views compute "since …" against this.
    @Published private(set) var now: Date = Date()

    private var snapshot: GoalDiskData = ([], [], [], [], [])
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
            Task { @MainActor in self?.refresh() }
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
        if snap.usage != usage { usage = snap.usage }
        let fresh = UserRequest.newlyTaken(before: requestsLoaded ? requests : nil, after: snap.requests,
                                           shown: takenShown.union(takenToAnimate))
        requestsLoaded = true
        if !fresh.isEmpty { takenToAnimate += fresh }
        if snap.requests != requests { requests = snap.requests }
        refresh()
    }

    func takenAnimationShown(_ id: String) {
        takenShown.insert(id)
        takenToAnimate.removeAll { $0 == id }
    }

    private func refresh() {
        let t = Date()
        let next = GoalBoard.rows(goals: snapshot.goals, sessions: snapshot.sessions, live: snapshot.live, now: t)
        now = t
        if next != rows { rows = next }
    }
}
