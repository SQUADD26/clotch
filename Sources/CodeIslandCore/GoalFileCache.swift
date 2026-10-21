import Foundation

/// Parsed files by key, re-read only when their mtime or size changed. `version` moves only when a
/// parsed value really changed, so a rewrite that changes nothing the board reads costs one parse.
/// Not thread-safe: one cache belongs to one serial loader.
public final class GoalFileCache<T: Equatable>: @unchecked Sendable {
    private struct Entry { let mtime: Date?; let size: Int?; let value: T? }
    private var entries: [String: Entry] = [:]
    private let key: (URL) -> String
    private var memo: [T]?
    /// Files actually read and parsed since the cache was made (tests read it).
    public private(set) var parses = 0
    public private(set) var version = 0

    /// `key` names a file across path spellings (/var vs /private/var): the session store uses the file name.
    public init(key: @escaping (URL) -> String = { $0.path }) { self.key = key }

    /// Every parsed value, in key order; rebuilt only after a change.
    public var all: [T] {
        if let memo { return memo }
        let out = entries.keys.sorted().compactMap { entries[$0]?.value }
        memo = out
        return out
    }

    /// Full rescan: `urls` are the whole folder; keys no longer listed are dropped.
    func replace(with urls: [URL], parse: (Data, URL) -> T?) {
        let listed = Set(urls.map(key))
        for k in entries.keys where !listed.contains(k) { set(k, nil) }
        update(urls, parse: parse)
    }

    /// Only `urls` are stat'ed (and parsed when changed); a vanished one is dropped.
    func update(_ urls: [URL], parse: (Data, URL) -> T?) {
        for url in urls {
            let v = try? url.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey])
            guard let mtime = v?.contentModificationDate else { set(key(url), nil); continue }
            let size = v?.fileSize
            if let e = entries[key(url)], e.mtime == mtime, e.size == size { continue }
            parses += 1
            set(key(url), Entry(mtime: mtime, size: size, value: (try? Data(contentsOf: url)).flatMap { parse($0, url) }))
        }
    }

    private func set(_ k: String, _ e: Entry?) {
        let old = entries[k]
        entries[k] = e
        if old?.value != e?.value { version += 1; memo = nil }
    }
}
