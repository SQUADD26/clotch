import Foundation

/// Parsed files by path, re-read only when their mtime or size changed: a watched folder with
/// thousands of files (1600+ desktop sessions) costs one listing per load, not one parse per file.
/// Not thread-safe: one cache belongs to one serial loader.
public final class GoalFileCache<T>: @unchecked Sendable {
    private struct Entry { let mtime: Date?; let size: Int?; let value: T? }
    private var entries: [String: Entry] = [:]
    /// Files actually read and parsed since the cache was made (tests read it).
    public private(set) var parses = 0
    /// False until one full listing filled the cache: `update` needs it as a base.
    public private(set) var scanned = false

    public init() {}

    /// Full rescan: the parsed values of `urls`; paths no longer listed are dropped from the cache.
    func values(_ urls: [URL], parse: (Data, URL) -> T?) -> [T] {
        var next: [String: Entry] = [:]
        for url in urls { next[url.path] = entry(url, parse: parse) }
        entries = next
        scanned = true
        return all
    }

    /// No listing: only `changed` (paths named by file events) are stat'ed; a vanished one is dropped.
    func update(_ changed: [URL], parse: (Data, URL) -> T?) -> [T] {
        for url in changed {
            entries[url.path] = FileManager.default.fileExists(atPath: url.path) ? entry(url, parse: parse) : nil
        }
        return all
    }

    private var all: [T] { entries.keys.sorted().compactMap { entries[$0]?.value } }

    private func entry(_ url: URL, parse: (Data, URL) -> T?) -> Entry {
        let v = try? url.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey])
        let (mtime, size) = (v?.contentModificationDate, v?.fileSize)
        if let e = entries[url.path], mtime != nil, e.mtime == mtime, e.size == size { return e }
        parses += 1
        return Entry(mtime: mtime, size: size, value: (try? Data(contentsOf: url)).flatMap { parse($0, url) })
    }
}

extension GoalSources {
    /// One cache per watched folder, kept by the watcher across loads.
    public final class Caches: @unchecked Sendable {
        public let goals = GoalFileCache<GoalRecord>()
        public let sessions = GoalFileCache<DesktopSession>()
        public let requests = GoalFileCache<UserRequest>()
        public init() {}
    }
}
