import Foundation

// Pure goal logic for the goal notch: no file I/O, no clock reads (the caller passes `now`).

public struct GoalProof: Equatable, Sendable { public let text: String; public let done: Bool; public let at: Date? }

/// One ~/.claude/obiettivi/<cli>.json
public struct GoalRecord: Equatable, Sendable {
    public let cli: String
    public let goal: String
    public let state: String      // aperto|raggiunto|bloccato|passato
    public let proof: String      // BLOCCATO / RAGGIUNTO text, "" if none
    public let at: Date?
    public let title: String      // may start with "★ ", may be ""
    public let proofs: [GoalProof]?   // nil when the "prove" key is absent
    public var successor: String? = nil  // "a": the cli that took this goal's place
}

/// One local_*.json of the Claude desktop app.
public struct DesktopSession: Equatable, Sendable {
    public let localId: String
    public let cliId: String
    public let parentLocalId: String?
    public var priorCliIds: [String] = []  // the cli ids this session had before a /clear or resume
    public let title: String
    public let isRunning: Bool    // false when the app did not write it: status then comes from activity time
    public let isArchived: Bool
    public let lastActivity: Date?
}

/// One ~/.claude/handoff/live/<cli>.json
public struct LiveState: Equatable, Sendable {
    public let cliId: String
    public let updated: Date?
    public let agents: [LiveAgent]
}

public struct LiveAgent: Equatable, Sendable {
    public let id: String
    public let alive: Bool
    public let lastActivity: Date?
}

public enum GoalStatus: Equatable, Sendable {
    case moving
    case still(since: Date)
    case blocked(reason: String)
    case reached
}

public struct GoalPulse: Identifiable, Equatable, Sendable {
    public enum Kind: Sendable { case master, child, subagent }
    public let id: String
    public let kind: Kind
    public let running: Bool
}

public struct GoalRow: Identifiable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let goal: String
    public let proofsDone: Int
    public let proofsTotal: Int
    public let progress: Double?
    public let status: GoalStatus
    public let lastActivity: Date?
    public let pulses: [GoalPulse]
}

public enum GoalBoard {
    public static let stillAfter: TimeInterval = 30 * 60

    public static func rows(goals: [GoalRecord], sessions: [DesktopSession], live: [LiveState], now: Date) -> [GoalRow] {
        let masters = index(sessions)
        let children = Dictionary(grouping: sessions.filter { $0.parentLocalId != nil }, by: { $0.parentLocalId! })
        let liveByCli = Dictionary(live.map { ($0.cliId, $0) }, uniquingKeysWith: { a, _ in a })

        var out: [GoalRow] = []
        for g in goals where g.state != "passato" {
            let master = masters[g.cli] ?? g.successor.flatMap { masters[$0] }
            if g.state == "raggiunto", master == nil || master!.isArchived { continue }

            let family = family(of: master, children: children)

            var times: [Date] = []
            var pulses: [GoalPulse] = []
            var busy = false
            for s in family {
                if let t = s.lastActivity { times.append(t) }
                if !s.isArchived {
                    pulses.append(GoalPulse(id: s.localId, kind: s.localId == master?.localId ? .master : .child, running: s.isRunning))
                    busy = busy || s.isRunning
                }
                guard let l = liveByCli[s.cliId] else { continue }
                if let t = l.updated { times.append(t) }
                for a in l.agents {
                    if let t = a.lastActivity { times.append(t) }
                    // An agent with no known time, or silent for 30 min, is dead (SubagentStop may never arrive).
                    guard a.alive, let t = a.lastActivity, now.timeIntervalSince(t) < stillAfter else { continue }
                    pulses.append(GoalPulse(id: "\(s.cliId):\(a.id)", kind: .subagent, running: true))
                    busy = true
                }
            }
            let last = times.max() ?? g.at

            let status: GoalStatus
            switch g.state {
            case "bloccato": status = .blocked(reason: g.proof)
            case "raggiunto": status = .reached
            default:
                if busy { status = .moving }
                else if let t = last, now.timeIntervalSince(t) >= stillAfter { status = .still(since: t) }
                else if last != nil { status = .moving }
                else { status = .still(since: now) }  // no evidence of life at all: not green
            }

            let total = g.proofs?.count ?? 0
            let done = g.proofs?.filter(\.done).count ?? 0
            let goal = g.goal.split(whereSeparator: \.isWhitespace).joined(separator: " ")
            // Never an empty row: the register title, else the session title, else the goal's first words.
            let title = [clean(g.title), clean(master?.title ?? ""), firstWords(clean(goal))]
                .first { $0.contains { $0.isLetter || $0.isNumber } } ?? "Obiettivo senza titolo"
            out.append(GoalRow(
                id: g.cli,
                title: title,
                goal: goal,
                proofsDone: done, proofsTotal: total,
                progress: g.state == "raggiunto" ? 1.0 : (total == 0 ? nil : Double(done) / Double(total)),
                status: status, lastActivity: last, pulses: pulses))
        }
        return out.sorted {
            let (a, b) = (rank($0.status), rank($1.status))
            if a != b { return a < b }
            if $0.lastActivity != $1.lastActivity { return ($0.lastActivity ?? .distantPast) > ($1.lastActivity ?? .distantPast) }
            return $0.id < $1.id
        }
    }

    /// The CLI ids whose live state can matter: every member of a shown goal's family.
    /// `GoalSources.load` reads only these live files, never the whole folder.
    public static func liveIds(goals: [GoalRecord], sessions: [DesktopSession]) -> Set<String> {
        let masters = index(sessions)
        let children = Dictionary(grouping: sessions.filter { $0.parentLocalId != nil }, by: { $0.parentLocalId! })
        var ids = Set<String>()
        for g in goals where g.state != "passato" {
            ids.insert(g.cli)
            for s in family(of: masters[g.cli] ?? g.successor.flatMap { masters[$0] }, children: children) { ids.insert(s.cliId) }
        }
        return ids
    }

    /// cli id -> session. A goal keeps the cli it was set under, so a session that changed id (/clear, resume)
    /// is found by its prior ids too; a current id always wins, and a live session wins over an archived one.
    static func index(_ sessions: [DesktopSession]) -> [String: DesktopSession] {
        var out = Dictionary(sessions.map { ($0.cliId, $0) }, uniquingKeysWith: { a, _ in a })
        for s in sessions.filter({ !$0.isArchived }) + sessions.filter(\.isArchived) {
            for p in s.priorCliIds where out[p] == nil { out[p] = s }
        }
        return out
    }

    /// Master + every non-archived descendant (visited set = cycle-safe).
    static func family(of master: DesktopSession?, children: [String: [DesktopSession]]) -> [DesktopSession] {
        var family: [DesktopSession] = master.map { [$0] } ?? []
        var seen = Set(family.map(\.localId))
        var queue = family
        while let s = queue.popLast() {
            for c in children[s.localId] ?? [] where seen.insert(c.localId).inserted {
                queue.append(c)
                if !c.isArchived { family.append(c) }
            }
        }
        return family
    }

    /// The goal chased now: an open goal with proofs still to do and recent activity (moving) beats one
    /// that is only always active; ties, and no such goal, go to the latest activity.
    public static func chased(_ rows: [GoalRow]) -> GoalRow? {
        let open = rows.filter { if case .reached = $0.status { return false } else { return true } }
        let working = open.filter { r in
            guard case .moving = r.status else { return false }
            return r.proofsTotal > 0 && r.proofsDone < r.proofsTotal
        }
        return (working.isEmpty ? open : working)
            .max { ($0.lastActivity ?? .distantPast) < ($1.lastActivity ?? .distantPast) } ?? rows.first
    }

    static func firstWords(_ t: String, _ n: Int = 6) -> String {
        let words = t.split(separator: " ")
        return words.prefix(n).joined(separator: " ") + (words.count > n ? "…" : "")
    }

    private static func rank(_ s: GoalStatus) -> Int {
        switch s { case .blocked: return 0; case .still: return 1; case .moving: return 2; case .reached: return 3 }
    }

    /// Title without signs and emoji (★, ⭕, 🛠️, flags…), spaces collapsed. Digits, # and * stay: they are emoji only with a keycap.
    static func clean(_ t: String) -> String {
        t.filter { c in
            !c.unicodeScalars.contains { $0.properties.generalCategory == .otherSymbol || $0.properties.isEmojiPresentation }
        }.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
}
