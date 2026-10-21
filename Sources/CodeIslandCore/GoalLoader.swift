import Foundation

/// The goal sources as the watcher reads them: work per reload follows the paths file events named,
/// never the 1600+ session files on disk. Full rescan only at launch or when events were dropped.
/// `sessions` in a snapshot are only those a shown goal reaches (`GoalBoard.reach`): a session outside
/// every goal family costs one parse when it changes, and no new board.
/// Not thread-safe: the watcher calls it from one serial queue.
public final class GoalLoader: @unchecked Sendable {
    public typealias Snapshot = (goals: [GoalRecord], sessions: [DesktopSession], live: [LiveState], requests: [UserRequest])
    /// Session stats and values kept across launches, so a restart parses only the files changed since.
    /// Bump the name when `DesktopSession` or `GoalSources.sessionKeys` change: the old file is then ignored.
    public static let indexName = "sessions-v3.json"

    public private(set) var paths: GoalSources.Paths
    private let makePaths: () -> GoalSources.Paths
    let goals = GoalFileCache<GoalRecord>()
    let sessions = GoalFileCache<DesktopSession>(key: { $0.lastPathComponent })
    let requests = GoalFileCache<UserRequest>()
    private var live: [String: LiveState] = [:]
    private var liveIds: Set<String> = []
    private var reached: [String] = []   // cache keys of the sessions a shown goal reaches, in cache order
    private var seenGoals: Int?
    private var shipped: (goals: Int, requests: Int)?
    private let index: URL?
    private var savedParses = 0
    private var savedAt: Date?

    public init(home: URL) {
        makePaths = { GoalSources.defaultPaths(home: home) }
        paths = makePaths()
        index = home.appendingPathComponent("Library/Application Support/Goal Notch/\(Self.indexName)")
    }

    init(paths: GoalSources.Paths, index: URL? = nil) {
        makePaths = { paths }
        self.paths = paths
        self.index = index
    }

    /// `changed` = paths named by file events since the last call; nil = rescan everything.
    /// nil result: nothing the board reads changed.
    public func load(changed: Set<String>?) -> Snapshot? {
        let fm = FileManager.default
        let rescan = changed == nil || shipped == nil
        if rescan { paths = makePaths() }
        let named = changed ?? []
        func touched(_ dir: URL) -> Bool {
            let spellings = [dir.path + "/", dir.resolvingSymlinksInPath().path + "/"]
            return rescan || named.contains { p in spellings.contains { p.hasPrefix($0) } }
        }

        // Small folders (a few goals, a few requests): re-listed whole, only when one of their files moved.
        if touched(paths.goals) {
            goals.replace(with: GoalSources.files(in: paths.goals, fm).filter { $0.pathExtension == "json" }) { d, _ in GoalSources.parseGoal(d) }
        }
        if touched(paths.requests) {
            requests.replace(with: GoalSources.files(in: paths.requests, fm).filter { $0.pathExtension == "json" }) { d, _ in GoalSources.parseRequest(d) }
        }
        let isSession = { (u: URL) in u.lastPathComponent.hasPrefix("local_") && u.pathExtension == "json" }
        let parseSession = { (d: Data, u: URL) -> DesktopSession? in
            var s = GoalSources.parseSession(d, fileName: u.lastPathComponent)
            s?.profile = SessionTarget.profile(ofSessionFile: u.path)
            return s
        }
        if shipped == nil, let index, let data = try? Data(contentsOf: index) { sessions.restore(data) }
        if rescan {
            sessions.replace(with: paths.sessionRoots.flatMap { GoalSources.files(in: $0, fm, recursive: true).filter(isSession) },
                             parse: parseSession)
        } else {
            let roots = paths.sessionRoots.flatMap { [$0.path + "/", $0.resolvingSymlinksInPath().path + "/"] }
            sessions.update(named.filter { p in roots.contains { p.hasPrefix($0) } }.map { URL(fileURLWithPath: $0) }.filter(isSession),
                            parse: parseSession)
        }

        // Which sessions and live files matter follows goals and family links: recomputed (O(all sessions))
        // only when a goal or a link changed; activity of a session outside every family changes nothing.
        let moved = sessions.takeChanged()
        var touchedReached = moved.keys.contains(where: Set(reached).contains)
        // A request's link follows its taker's session file, which may sit outside every goal family.
        let takers = Set(requests.all.filter(\.taken).flatMap { [$0.takenBy, $0.localId] })
        let touchedTaker = moved.keys.contains { k in sessions[k].map { takers.contains($0.cliId) || takers.contains($0.localId) || $0.priorCliIds.contains(where: takers.contains) } ?? false }
        let relinked = moved.contains { k, old in old.map(Self.link) != sessions[k].map(Self.link) }
        if rescan || relinked || seenGoals != goals.version {
            let reach = GoalBoard.reach(goals: goals.all, sessions: sessions.all)
            let next = sessions.keys.filter { sessions[$0].map { reach.sessions.contains($0.localId) } ?? false }
            if next != reached { touchedReached = true }
            reached = next
            liveIds = reach.live
            seenGoals = goals.version
        }
        var liveMoved = live.keys.contains { !liveIds.contains($0) }
        live = live.filter { liveIds.contains($0.key) }
        let liveDirs = [paths.live.path + "/", paths.live.resolvingSymlinksInPath().path + "/"]
        let namedLive = Set(named.filter { p in liveDirs.contains { p.hasPrefix($0) } }.map { URL(fileURLWithPath: $0).deletingPathExtension().lastPathComponent })
        for cli in liveIds where rescan || live[cli] == nil || namedLive.contains(cli) {
            let fresh = GoalSources.readLive(cli: cli, dir: paths.live, fm)
            if fresh != live[cli] { liveMoved = true }
            live[cli] = fresh
        }

        saveIndex(force: rescan)

        // Unchanged values (a rewrite with the same content, a live file of another session): no new board.
        let versions = (goals.version, requests.version)
        if !rescan, !liveMoved, !touchedReached, !touchedTaker, let shipped, shipped == versions { return nil }
        shipped = versions
        let byCli = takers.isEmpty ? [:] : GoalBoard.index(sessions.all)
        let byLocal = takers.isEmpty ? [:] : Dictionary(sessions.all.map { ($0.localId, $0) }, uniquingKeysWith: { a, _ in a })
        // The register's own `local_id` first; the cli id of `presa_da` only as a fallback (older requests).
        let linked = requests.all.map { r -> UserRequest in
            guard r.taken else { return r }
            let s = r.localId.isEmpty ? byCli[r.takenBy] : byLocal[r.localId]  // never another session folder for a given id
            guard let id = r.localId.isEmpty ? s?.localId : r.localId else { return r }
            var r = r
            r.target = SessionTarget(localId: id, profile: s?.profile ?? "")
            return r
        }
        return (goals.all, reached.compactMap { sessions[$0] }, live.keys.sorted().compactMap { live[$0] },
                linked.sorted { ($0.at ?? .distantPast, $0.id) > ($1.at ?? .distantPast, $1.id) })
    }

    /// What ties a session into a goal family; anything else (title, activity) matters only inside one.
    private static func link(_ s: DesktopSession) -> [String] {
        [s.localId, s.cliId, s.parentLocalId ?? "", s.isArchived ? "a" : ""] + s.priorCliIds
    }

    /// After the launch rescan, then at most every 10 minutes and only if something was parsed: no timer.
    private func saveIndex(force: Bool) {
        guard let index, sessions.parses != savedParses else { return }
        if !force, let savedAt, Date().timeIntervalSince(savedAt) < 600 { return }
        guard let data = sessions.encoded() else { return }
        try? FileManager.default.createDirectory(at: index.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? data.write(to: index, options: .atomic)
        savedParses = sessions.parses
        savedAt = Date()
    }
}
