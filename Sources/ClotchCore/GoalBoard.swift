import Foundation

// Pure goal logic for the Clotch: no file I/O, no clock reads (the caller passes `now`).

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
    public var profile = ""  // data folder of the app copy that owns the file (`SessionTarget.profile`)
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
    public var master: SessionTarget? = nil  // the session that carries the goal: the title opens it
    public var motor: SessionMotor? = nil  // the engine's true state of the master session (clotch#114); nil = not written yet
}

extension GoalRow {
    /// When the work-time counter stops; nil = it runs. It follows the status only: a moving goal counts
    /// even with no session marked running (the app often leaves `isRunning` out, #49); a still goal stops
    /// when it went still; a closed one at its last sign of work.
    public var workEnd: Date? {
        switch status {
        case .moving: return nil
        case .still(let at): return motor == nil ? at : nil  // the engine's state counts its own time, whatever it is
        case .blocked, .reached: return lastActivity ?? since
        }
    }

    /// What the session does now. The register's «bloccato» is a problem and beats the engine; otherwise the
    /// engine's word wins, and with no engine file activity decides: moving works, anything else is still.
    public var phase: SessionPhase {
        switch status {
        case .blocked: return .problema
        case .reached: return .ferma
        case .moving, .still: return motor?.phase ?? (status == .moving ? .lavora : .ferma)
        }
    }

    /// The colour of the mark: the engine's, else the phase's.
    public var phaseRGB: RGB { motor.flatMap { $0.phase == phase ? $0.rgb : nil } ?? phase.rgb }

    /// The timer counts the time in the state; without an engine file it falls back to the goal's own start.
    public var clockStart: Date? { motor?.since ?? since }
}

public enum GoalBoard {
    public static let stillAfter: TimeInterval = 30 * 60
    /// Register states the notch shows; a new or unknown state stays hidden until it is added here.
    static let shown: Set<String> = ["aperto", "bloccato", "raggiunto", "proposto"]

    public static func rows(goals: [GoalRecord], sessions: [DesktopSession], live: [LiveState], motor: [SessionMotor] = [], now: Date) -> [GoalRow] {
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
                proposal: g.state == "proposto" ? goal : g.proposal, closed: master?.isArchived ?? true,
                master: master.map { SessionTarget(localId: $0.localId, profile: $0.profile) },
                motor: engineState(of: g.cli, master: master, in: motor)))
        }
        return out.sorted {
            let (a, b) = (rank($0), rank($1))
            if a != b { return a < b }
            if $0.lastActivity != $1.lastActivity { return ($0.lastActivity ?? .distantPast) > ($1.lastActivity ?? .distantPast) }
            return $0.id < $1.id
        }
    }

    /// The engine's file for a goal's master: by the goal's cli, the master's current cli, or its Claude app id
    /// (a /clear leaves the old file beside the new one); the one with the latest sign of life wins.
    static func engineState(of cli: String, master: DesktopSession?, in motor: [SessionMotor]) -> SessionMotor? {
        motor.filter { $0.cli == cli || $0.cli == master?.cliId || (!$0.localId.isEmpty && $0.localId == master?.localId) }
            .max { ($0.seen ?? .distantPast) < ($1.seen ?? .distantPast) }
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

    /// The open Goals tab keeps its order (#36): ids already shown keep their place, new ones go at the end,
    /// gone ones leave. So arrivals never move the page Roberto is reading.
    public static func keepOrder(_ shown: [String], _ fresh: [String]) -> [String] {
        let live = Set(fresh)
        let kept = shown.filter(live.contains)
        return kept + fresh.filter { !kept.contains($0) }
    }

    static func firstWords(_ t: String, _ n: Int = 6) -> String {
        let words = t.split(separator: " ")
        return words.prefix(n).joined(separator: " ") + (words.count > n ? "…" : "")
    }

    /// Problem, waiting for Roberto, still, working or waiting for something else, then proposed (quiet), then reached, then goals of closed sessions.
    private static func rank(_ r: GoalRow) -> Int {
        if r.closed { return 6 }
        if r.proposed { return 4 }
        if case .reached = r.status { return 5 }
        switch r.phase { case .problema: return 0; case .aspettaRoberto: return 1; case .ferma: return 2; case .lavora, .aspettaAltro: return 3 }
    }

    /// The title as written, icons included (★, ◰︎, 🎨, #79), spaces collapsed.
    static func clean(_ t: String) -> String {
        t.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
}
