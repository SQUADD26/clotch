import Foundation

/// Parsed files by path, re-read only when their mtime or size changed: a watched folder with
/// thousands of files (1600+ desktop sessions) costs one listing per load, not one parse per file.
/// Not thread-safe: one cache belongs to one serial loader.
public final class GoalFileCache<T>: @unchecked Sendable {
    private struct Entry { let mtime: Date?; let size: Int?; let value: T? }
    private var entries: [String: Entry] = [:]
    /// Files actually read and parsed since the cache was made (tests read it).
    public private(set) var parses = 0

    public init() {}

    /// The parsed values of `urls`, in order. Paths no longer listed are dropped from the cache.
    func values(_ urls: [URL], parse: (Data, URL) -> T?) -> [T] {
        var next: [String: Entry] = [:]
        let out = urls.compactMap { url -> T? in
            let v = try? url.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey])
            let (mtime, size) = (v?.contentModificationDate, v?.fileSize)
            if let e = entries[url.path], mtime != nil, e.mtime == mtime, e.size == size {
                next[url.path] = e
                return e.value
            }
            parses += 1
            let value = (try? Data(contentsOf: url)).flatMap { parse($0, url) }
            next[url.path] = Entry(mtime: mtime, size: size, value: value)
            return value
        }
        entries = next
        return out
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
