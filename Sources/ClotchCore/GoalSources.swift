import Foundation

/// Parsing and folder reading for the Clotch. Strictly read-only: a missing or
/// unreadable file means "no data", never an error, and nothing is ever created.
public enum GoalSources {
    // MARK: Parsing

    public static func parseGoal(_ data: Data) -> GoalRecord? {
        guard let d = object(data), let cli = d["cli"] as? String, !cli.isEmpty,
              let goal = d["obiettivo"] as? String else { return nil }
        let proofs = (d["prove"] as? [Any]).map { list in
            list.compactMap { item -> GoalProof? in
                guard let p = item as? [String: Any], let text = p["testo"] as? String else { return nil }
                return GoalProof(text: text, done: p["fatta"] as? Bool ?? false, at: date(p["t"]))
            }
        }
        return GoalRecord(cli: cli, goal: goal, state: d["stato"] as? String ?? "aperto",
                          proof: d["prova"] as? String ?? "", at: date(d["t"]),
                          title: d["titolo"] as? String ?? "", proofs: proofs, successor: d["a"] as? String,
                          proposal: (d["proposta"] as? [String: Any])?["testo"] as? String, lastSeen: date(d["ultima_attivita"]))
    }

    /// nil for scheduled-task sessions and sessions without a CLI id (same filter as overseer_fonti.leggi_sessioni).
    /// Reads only the keys below: ~98 % of a session file is MCP config the board never uses, skipped unbuilt.
    public static func parseSession(_ data: Data, fileName: String) -> DesktopSession? {
        guard let d = topLevel(data, keys: sessionKeys), (d["scheduledTaskId"] as? String ?? "").isEmpty,
              let cli = d["cliSessionId"] as? String, !cli.isEmpty else { return nil }
        let parent = (d["spawnedFrom"] as? [String: Any])?["sessionId"] as? String ?? d["spawnedFrom"] as? String
        let fileId = fileName.hasSuffix(".json") ? String(fileName.dropLast(5)) : fileName
        return DesktopSession(localId: d["sessionId"] as? String ?? fileId, cliId: cli,
                              parentLocalId: parent?.isEmpty == false ? parent : nil,
                              priorCliIds: (d["priorRemoteCliSessionIds"] as? [Any] ?? []).compactMap { $0 as? String },
                              title: d["title"] as? String ?? "", isRunning: d["isRunning"] as? Bool ?? false,
                              isArchived: d["isArchived"] as? Bool ?? false, lastActivity: date(d["lastActivityAt"]),
                              prs: PullRequests.parse(d["prs"]))
    }

    public static func parseLive(_ data: Data, cliId: String) -> LiveState? {
        parseLive(data, cliId: cliId, transcriptMTime: { _ in nil })
    }

    /// `transcriptMTime(agentId)` lets the folder reader add a subagent transcript's mtime to its activity.
    static func parseLive(_ data: Data, cliId: String, transcriptMTime: (String) -> Date?) -> LiveState? {
        guard let d = object(data) else { return nil }
        let agents = (d["agenti"] as? [String: Any] ?? [:]).compactMap { id, v -> LiveAgent? in
            guard let a = v as? [String: Any] else { return nil }
            let alive = a["stato"] as? String == "vivo"
            // Disk is touched only for alive agents: a finished one never pulses again.
            let times = [date(a["partito"]), date((a["ultimo_tool"] as? [String: Any])?["quando"]), alive ? transcriptMTime(id) : nil]
            return LiveAgent(id: id, alive: alive, lastActivity: times.compactMap { $0 }.max())
        }.sorted { $0.id < $1.id }
        return LiveState(cliId: cliId, updated: date(d["aggiornato"]), agents: agents)
    }

    // MARK: Folders

    public struct Paths: Sendable {
        public var goals: URL; public var live: URL; public var sessionRoots: [URL]; public var requests: URL
        /// One `<cli>.json` per session, written by the config's engine: the session's true state (clotch#114).
        public var states: URL
    }

    public static func defaultPaths(home: URL) -> Paths {
        let support = home.appendingPathComponent("Library/Application Support")
        let apps = (try? FileManager.default.contentsOfDirectory(atPath: support.path)) ?? []
        let roots = apps.filter { $0.hasPrefix("Claude") || $0.hasPrefix("claude") }.sorted().map {
            support.appendingPathComponent($0).appendingPathComponent("claude-code-sessions")
        }
        return Paths(goals: home.appendingPathComponent(".claude/obiettivi"),
                     live: home.appendingPathComponent(".claude/handoff/live"), sessionRoots: roots,
                     requests: home.appendingPathComponent(".claude/richieste"),
                     states: home.appendingPathComponent(".claude/handoff/stato"))
    }

    /// One full read (launch of `--snapshot`, tests). The app's watcher keeps one `GoalLoader` instead.
    public static func load(_ paths: Paths) -> GoalLoader.Snapshot {
        GoalLoader(paths: paths).load(changed: nil)!
    }

    /// One live file, with alive subagents' transcript mtimes as activity.
    static func readLive(cli: String, dir: URL, _ fm: FileManager) -> LiveState? {
        guard !cli.contains("/"), let data = try? Data(contentsOf: dir.appendingPathComponent(cli + ".json")) else { return nil }
        let transcript = object(data)?["transcript"] as? String ?? ""
        var index: [String: Date]?  // built at most once per transcript, only if a direct stat misses
        return parseLive(data, cliId: cli) { aid in
            subagentMTime(transcript: transcript, agentId: aid, index: &index, fm)
        }
    }

    /// Lists with mtime and size prefetched, so the cache's stat of each file is free.
    static func files(in dir: URL, _ fm: FileManager, recursive: Bool = false) -> [URL] {
        let keys: [URLResourceKey] = [.contentModificationDateKey, .fileSizeKey]
        if recursive {
            return fm.enumerator(at: dir, includingPropertiesForKeys: keys)?.allObjects as? [URL] ?? []
        }
        return (try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: keys)) ?? []
    }

    /// `<transcript without .jsonl>/subagents/agent-<id>.jsonl` by one stat; nested layouts
    /// (`subagents/**/agent-<id>.jsonl`, live_state.scaduti) through one listing of that transcript's tree.
    private static func subagentMTime(transcript: String, agentId: String, index: inout [String: Date]?, _ fm: FileManager) -> Date? {
        guard transcript.hasSuffix(".jsonl") else { return nil }
        let dir = URL(fileURLWithPath: String(transcript.dropLast(6))).appendingPathComponent("subagents")
        let name = "agent-\(agentId).jsonl"
        if let d = mtime(dir.appendingPathComponent(name).path, fm) { return d }
        if index == nil {
            var built: [String: Date] = [:]
            for url in files(in: dir, fm, recursive: true) where url.lastPathComponent.hasPrefix("agent-") {
                if let d = mtime(url.path, fm), d > built[url.lastPathComponent] ?? .distantPast { built[url.lastPathComponent] = d }
            }
            index = built
        }
        return index?[name]
    }

    private static func mtime(_ path: String, _ fm: FileManager) -> Date? {
        (try? fm.attributesOfItem(atPath: path))?[.modificationDate] as? Date
    }

    // MARK: Helpers

    static let sessionKeys: Set<String> = ["scheduledTaskId", "cliSessionId", "spawnedFrom", "sessionId",
                                           "priorRemoteCliSessionIds", "title", "isRunning", "isArchived", "lastActivityAt", "prs"]

    /// A top-level JSON object with only `keys` parsed; every other value is skipped byte by byte, never built.
    /// nil when the object is malformed or truncated (a file caught mid-write).
    static func topLevel(_ data: Data, keys: Set<String>) -> [String: Any]? {
        data.withUnsafeBytes { (raw: UnsafeRawBufferPointer) -> [String: Any]? in
            let b = raw.bindMemory(to: UInt8.self)
            let n = b.count
            var i = 0
            func space() { while i < n, b[i] == 0x20 || b[i] == 0x0A || b[i] == 0x0D || b[i] == 0x09 { i += 1 } }
            func string() -> Bool {  // b[i] == '"'; leaves i after the closing quote
                i += 1
                while i < n {
                    let c = b[i]
                    if c == 0x5C { i += 2; continue }
                    i += 1
                    if c == 0x22 { return true }
                }
                return false
            }
            func value() -> Bool {
                guard i < n else { return false }
                switch b[i] {
                case 0x22: return string()
                case 0x7B, 0x5B:
                    var depth = 0
                    while i < n {
                        let c = b[i]
                        if c == 0x22 { if !string() { return false }; continue }
                        if c == 0x7B || c == 0x5B { depth += 1 }
                        else if c == 0x7D || c == 0x5D { depth -= 1; if depth == 0 { i += 1; return true } }
                        i += 1
                    }
                    return false
                default:  // number, true, false, null
                    let start = i
                    while i < n, ![0x2C, 0x7D, 0x5D, 0x20, 0x0A, 0x0D, 0x09].contains(b[i]) { i += 1 }
                    return i > start
                }
            }
            space()
            guard i < n, b[i] == 0x7B else { return nil }
            i += 1
            var out: [String: Any] = [:]
            while true {
                space()
                guard i < n else { return nil }
                if b[i] == 0x7D { return out }
                if b[i] == 0x2C { i += 1; continue }
                guard b[i] == 0x22 else { return nil }
                let k0 = i + 1
                guard string() else { return nil }
                let key = String(decoding: UnsafeBufferPointer(rebasing: b[k0..<(i - 1)]), as: UTF8.self)
                space()
                guard i < n, b[i] == 0x3A else { return nil }
                i += 1
                space()
                let v0 = i
                guard value() else { return nil }
                if keys.contains(key) {
                    let slice = Data(UnsafeRawBufferPointer(rebasing: raw[v0..<i]))
                    out[key] = try? JSONSerialization.jsonObject(with: slice, options: .fragmentsAllowed)
                }
            }
        }
    }

    static func object(_ data: Data) -> [String: Any]? {
        (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    /// "2026-10-21T13:13:52+0300" | "…+03:00" | "…Z" | "2026-10-21T13:13:52" (local time) | epoch milliseconds (or seconds).
    static func date(_ v: Any?) -> Date? {
        if let n = v as? NSNumber, !(v is Bool) {
            return Date(timeIntervalSince1970: n.doubleValue > 1e11 ? n.doubleValue / 1000 : n.doubleValue)
        }
        guard let s = (v as? String)?.trimmingCharacters(in: .whitespaces), s.count >= 19 else { return nil }
        let head = s.prefix(19), zone = s.dropFirst(19)
        let n = head.split(whereSeparator: { "-T: ".contains($0) }).compactMap { Int($0) }
        guard n.count == 6 else { return nil }
        var tz = TimeZone.current
        if zone == "Z" { tz = TimeZone(secondsFromGMT: 0)! }
        else if let sign = zone.first, "+-".contains(sign) {
            let d = zone.dropFirst().filter(\.isNumber)
            guard d.count == 4, let h = Int(d.prefix(2)), let m = Int(d.suffix(2)),
                  let z = TimeZone(secondsFromGMT: (sign == "-" ? -1 : 1) * (h * 3600 + m * 60)) else { return nil }
            tz = z
        } else if !zone.isEmpty { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = tz
        return cal.date(from: DateComponents(year: n[0], month: n[1], day: n[2], hour: n[3], minute: n[4], second: n[5]))
    }
}
