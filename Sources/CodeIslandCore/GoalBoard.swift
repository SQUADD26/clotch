import Foundation

// Pure goal logic for the goal notch: no file I/O, no clock reads (the caller passes `now`).

public struct GoalProof: Equatable, Sendable { public let text: String; public let done: Bool; public let at: Date? }

/// One ~/.claude/obiettivi/<cli>.json
public struct GoalRecord: Equatable, Sendable {
    public let cli: String
    public let goal: String
    public let state: String      // aperto|bloccato|raggiunto|proposto shown; nessuno|passato|anything else hidden
    public let proof: String      // BLOCCATO / RAGGIUNTO text, "" if none
    public let at: Date?
    public let title: String      // may start with "★ ", may be ""
    public let proofs: [GoalProof]?   // nil when the "prove" key is absent
    public var successor: String? = nil  // "a": the cli that took this goal's place
    public var proposal: String? = nil   // "proposta.testo": a new goal proposed beside the open one, not confirmed yet
    public var lastSeen: Date? = nil     // "ultima_attivita": the hook's sign of life at each prompt and Stop of the live session
}

/// One local_*.json of the Claude desktop app.
public struct DesktopSession: Equatable, Sendable, Codable {
    public let localId: String
    public let cliId: String
    public let parentLocalId: String?
    public var priorCliIds: [String] = []  // the cli ids this session had before a /clear or resume
    public let title: String
    public let isRunning: Bool    // false when the app did not write it: status then comes from activity time
    public let isArchived: Bool
    public let lastActivity: Date?
    public var prs: [SessionPR] = []  // the session's own pull requests (`prs` of the session file)
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
    public var proposed = false   // "proposto": not accepted yet, shown quieter, never the goal chased now
    public var since: Date? = nil  // when the goal took its present text and state: the work-time counter starts here
    public var proposal: String? = nil  // text waiting for Roberto's yes: the proposed goal, or a proposal beside the open one
    public var closed = false  // its master session is archived or gone: kept out of the list, only counted
}

public enum GoalBoard {
    public static let stillAfter: TimeInterval = 30 * 60
    /// Register states the notch shows; a new or unknown state stays hidden until it is added here.
    static let shown: Set<String> = ["aperto", "bloccato", "raggiunto", "proposto"]

    public static func rows(goals: [GoalRecord], sessions: [DesktopSession], live: [LiveState], now: Date) -> [GoalRow] {
        let masters = index(sessions)
        let children = Dictionary(grouping: sessions.filter { $0.parentLocalId != nil }, by: { $0.parentLocalId! })
        let liveByCli = Dictionary(live.map { ($0.cliId, $0) }, uniquingKeysWith: { a, _ in a })

        var out: [GoalRow] = []
        for g in goals where shown.contains(g.state) {
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
            if let t = g.lastSeen { times.append(t) }  // follows the session that works on it, whatever its id
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
                status: status, lastActivity: last, pulses: pulses, proposed: g.state == "proposto", since: g.at,
                proposal: g.state == "proposto" ? goal : g.proposal, closed: master?.isArchived ?? true))
        }
        return out.sorted {
            let (a, b) = (rank($0), rank($1))
            if a != b { return a < b }
            if $0.lastActivity != $1.lastActivity { return ($0.lastActivity ?? .distantPast) > ($1.lastActivity ?? .distantPast) }
            return $0.id < $1.id
        }
    }

    /// What a shown goal can read. `sessions`: the local ids of every master and descendant, archived links
    /// included, so `rows` over just these sessions (in their original order) equals `rows` over all of them.
    /// `live`: the CLI ids whose live state can matter; `GoalSources.load` reads only these live files.
    public static func reach(goals: [GoalRecord], sessions: [DesktopSession]) -> (sessions: Set<String>, live: Set<String>) {
        let masters = index(sessions)
        let children = Dictionary(grouping: sessions.filter { $0.parentLocalId != nil }, by: { $0.parentLocalId! })
        var reached = Set<String>(), live = Set<String>()
        for g in goals where shown.contains(g.state) {
            live.insert(g.cli)
            let master = masters[g.cli] ?? g.successor.flatMap { masters[$0] }
            for s in family(of: master, children: children, includeArchived: true) {
                reached.insert(s.localId)
                if s.localId == master?.localId || !s.isArchived { live.insert(s.cliId) }
            }
        }
        return (reached, live)
    }

    /// The first instant after `now` when time alone can change a row (30 min of silence turns it still,
    /// a silent subagent stops counting): the store recomputes then, never on a periodic tick.
    public static func nextChange(goals: [GoalRecord], sessions: [DesktopSession], live: [LiveState], now: Date) -> Date? {
        let liveByCli = Dictionary(live.map { ($0.cliId, $0) }, uniquingKeysWith: { a, _ in a })
        var times = goals.compactMap(\.at) + goals.compactMap(\.lastSeen)
        for s in sessions {
            if let t = s.lastActivity { times.append(t) }
            guard let l = liveByCli[s.cliId] else { continue }
            times += [l.updated].compactMap { $0 } + l.agents.compactMap(\.lastActivity)
        }
        return times.map { $0.addingTimeInterval(stillAfter) }.filter { $0 > now }.min()
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

    /// Master + every non-archived descendant (visited set = cycle-safe); `includeArchived` keeps the archived ones too.
    static func family(of master: DesktopSession?, children: [String: [DesktopSession]], includeArchived: Bool = false) -> [DesktopSession] {
        var family: [DesktopSession] = master.map { [$0] } ?? []
        var seen = Set(family.map(\.localId))
        var queue = family
        while let s = queue.popLast() {
            for c in children[s.localId] ?? [] where seen.insert(c.localId).inserted {
                queue.append(c)
                if includeArchived || !c.isArchived { family.append(c) }
            }
        }
        return family
    }

    /// The goal chased now, among open goals (not reached, not proposed), latest activity first:
    /// (a) proofs in progress (0 < done < total), else (b) any declared proofs, else (c) any open goal.
    /// An always-active goal without proofs (the Overseer) never beats one whose proofs are moving.
    public static func chased(_ rows: [GoalRow]) -> GoalRow? {
        let open = rows.filter { r in
            if case .reached = r.status { return false }
            return !r.proposed && !r.closed
        }
        let pool = [open.filter { 0 < $0.proofsDone && $0.proofsDone < $0.proofsTotal },
                    open.filter { $0.proofsTotal > 0 }, open].first { !$0.isEmpty } ?? []
        return pool.max { ($0.lastActivity ?? .distantPast) < ($1.lastActivity ?? .distantPast) }
            ?? rows.first { !$0.proposed && !$0.closed }
    }

    /// The Goals tab (#20): confirmed goals of live sessions; proposals waiting for Roberto, minus the ones he
    /// rejected (`GoalDecision.key`); and how many goals of archived or gone sessions are left out.
    public static func tab(_ rows: [GoalRow], rejected: Set<String> = []) -> (goals: [GoalRow], toConfirm: [GoalRow], closed: Int) {
        let live = rows.filter { !$0.closed }
        let toConfirm = live.filter { r in r.proposal.map { !rejected.contains(GoalDecision.key(cli: r.id, text: $0)) } ?? false }
        return (live.filter { !$0.proposed }, toConfirm, rows.count - live.count)
    }

    static func firstWords(_ t: String, _ n: Int = 6) -> String {
        let words = t.split(separator: " ")
        return words.prefix(n).joined(separator: " ") + (words.count > n ? "…" : "")
    }

    /// Blocked, still, moving, then proposed (quiet), then reached, then goals of closed sessions.
    private static func rank(_ r: GoalRow) -> Int {
        if r.closed { return 5 }
        if r.proposed { return 3 }
        switch r.status { case .blocked: return 0; case .still: return 1; case .moving: return 2; case .reached: return 4 }
    }

    /// Title without signs and emoji (★, ⭕, 🛠️, flags…), spaces collapsed. Digits, # and * stay: they are emoji only with a keycap.
    static func clean(_ t: String) -> String {
        t.filter { c in
            !c.unicodeScalars.contains { $0.properties.generalCategory == .otherSymbol || $0.properties.isEmojiPresentation }
        }.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
}
