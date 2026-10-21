import Foundation

/// Parsed files by key, re-read only when their mtime or size changed. `version` moves only when a
/// parsed value really changed, so a rewrite that changes nothing the board reads costs one parse.
/// Values keep first-seen order and are never sorted: per-change work is O(changed).
/// Not thread-safe: one cache belongs to one serial loader.
public final class GoalFileCache<T: Equatable>: @unchecked Sendable {
    private struct Entry { let mtime: Date?; let size: Int?; let value: T? }
    private var entries: [String: Entry] = [:]
    private var order: [String] = []   // first-seen
    private let key: (URL) -> String
    private var memo: [T]?
    /// Files actually read and parsed since the cache was made (tests read it).
    public private(set) var parses = 0
    public private(set) var version = 0
    /// Keys whose value changed since the last `takeChanged()`, with their value before the first change.
    private var changed: [String: T?] = [:]

    /// `key` names a file across path spellings (/var vs /private/var): the session store uses the file name.
    public init(key: @escaping (URL) -> String = { $0.path }) { self.key = key }

    /// Every parsed value, in first-seen order; rebuilt only after a change.
    public var all: [T] {
        if let memo { return memo }
        let out = order.compactMap { entries[$0]?.value }
        memo = out
        return out
    }

    /// Every key with a parsed value, in the order of `all`.
    var keys: [String] { order.filter { entries[$0]?.value != nil } }

    subscript(_ k: String) -> T? { entries[k]?.value }

    func takeChanged() -> [String: T?] {
        defer { changed = [:] }
        return changed
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
        if old == nil, e != nil { order.append(k) }
        if old != nil, e == nil { order.removeAll { $0 == k } }  // O(n), only when a file disappears
        entries[k] = e
        if old?.value != e?.value {
            version += 1; memo = nil
            if changed[k] == nil { changed[k] = .some(old?.value) }
        }
    }
}

extension GoalFileCache where T: Codable {
    private struct Stored: Codable { let k: String; let m: Date; let s: Int?; let v: T? }

    /// Stat and value of every file, so the next launch parses only the files changed since.
    func encoded() -> Data? {
        try? JSONEncoder().encode(order.compactMap { k in
            entries[k].flatMap { e in e.mtime.map { Stored(k: k, m: $0, s: e.size, v: e.value) } }
        })
    }

    /// Seeds an empty cache from `encoded()`; the rescan that follows re-parses only files whose stat moved.
    func restore(_ data: Data) {
        guard entries.isEmpty, let list = try? JSONDecoder().decode([Stored].self, from: data) else { return }
        for e in list { set(e.k, Entry(mtime: e.m, size: e.s, value: e.v)) }
    }
}
