import Foundation
import CodeIslandCore

/// Where the voice's news comes in (#57). With `~/.config/voce/eventi.jsonl` (claude-config#1854) only its new lines
/// count; without it Clotch derives the same events from what it already reads: the end of a turn (a question for
/// Roberto), the goals and requests registers, account usage, merged PRs and the «Avvisami quando…» rules.
/// `VoiceAlertEngine` decides what is said; `VoiceSpeaker.say` says it, one at a time.
@MainActor
final class VoiceAlertCenter {
    static let shared = VoiceAlertCenter()

    private let files = VoiceFiles()
    private var engine = VoiceAlertEngine()
    private var speaking = false
    /// The last state seen of each register: nil until the first load (the baseline, so a launch says nothing).
    private var goals: [GoalRecord]?
    private var requests: [UserRequest]?
    private var quotas: [AccountQuota]?
    private var eventsOffset: Int?
    private var clock: Timer?

    /// claude-config writes the events: Clotch derives none itself, so nothing is said twice.
    private var fromFile: Bool { FileManager.default.fileExists(atPath: files.eventsURL.path) }

    /// The rules that wait on time (`ora`, `file`, `sessione-ferma`) are checked each minute; the others on their fact.
    func start() {
        eventsChanged()
        clock = clock ?? Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { _ in
            MainActor.assumeIsolated { VoiceAlertCenter.shared.checkRules(VoiceAlertRule.Facts(now: Date())) }
        }
    }

    // MARK: Sources

    /// New lines of eventi.jsonl (`VoiceStore` sees the file change). The first read only takes the size: old news stays old.
    func eventsChanged() {
        guard let data = try? Data(contentsOf: files.eventsURL) else { eventsOffset = nil; return }
        guard let from = eventsOffset else { eventsOffset = data.count; return }
        let read = VoiceEvents.appended(data, from: from)
        eventsOffset = read.offset
        offer(read.events)
    }

    /// An end of turn the Stop hook queued.
    func stopped(_ payload: Data) {
        guard !fromFile, let stop = VoiceEvents.stop(payload: payload, transcriptTail: VoiceSpeaker.tail, now: Date()) else { return }
        offer(stop.question.map { [$0] } ?? [])
        var facts = VoiceAlertRule.Facts(now: Date())
        facts.answer = stop.answer
        checkRules(facts)
    }

    /// Every load of the goals and requests registers (`GoalStore`).
    func registersLoaded(goals next: [GoalRecord], requests nextRequests: [UserRequest]) {
        let now = Date()
        let events = VoiceEvents.goals(before: goals, after: next, now: now) + VoiceEvents.requests(before: requests, after: nextRequests, now: now)
        goals = next
        requests = nextRequests
        if !fromFile { offer(events) }
    }

    /// Every account reading (`AccountQuotaFeed`).
    func quotasRead(_ next: [AccountQuota]) {
        let events = VoiceEvents.quotas(before: quotas, after: next, now: Date())
        quotas = next
        if !fromFile { offer(events) }
    }

    /// PRs seen merged for the first time (`PullRequestFeed`).
    func merged(_ prs: [PRInfo]) {
        var facts = VoiceAlertRule.Facts(now: Date())
        facts.mergedPRs = prs.map(\.ref)
        checkRules(facts)
    }

    // MARK: «Avvisami quando…»

    private func checkRules(_ base: VoiceAlertRule.Facts) {
        guard !fromFile else { return }  // claude-config's heartbeat checks them and writes `avviso_custom`
        let rules = VoiceAlertRule.parse(try? Data(contentsOf: files.alertsURL))
        guard rules.contains(where: { $0.fired == nil }) else { return }
        Task {
            var facts = base
            facts.sessions = await GoalStore.shared.allSessions()
            var events: [VoiceEvent] = [], fired: Set<String> = []
            for r in rules {
                guard let e = r.fires(facts) else { continue }
                events.append(e)
                fired.insert(r.id)
            }
            guard !events.isEmpty else { return }
            // Re-read before writing: the page or `avvisami` may have changed the file meanwhile; only `scattato` is set.
            let latest = VoiceAlertRule.parse(try? Data(contentsOf: files.alertsURL)).map { r in
                var r = r
                if fired.contains(r.id), r.fired == nil { r.fired = facts.now }
                return r
            }
            try? files.write(VoiceAlertRule.encode(latest), to: files.alertsURL)
            offer(events)
        }
    }

    // MARK: Engine

    private func offer(_ events: [VoiceEvent]) {
        guard !events.isEmpty, files.isOn, files.key != nil else { return }
        Task {
            let sessions = await GoalStore.shared.allSessions()
            let config = VoiceTurn.Config((try? files.readConfig()) ?? [:])
            for e in events { _ = engine.offer(e, config: config, sessions: sessions, now: Date()) }
            pump()
        }
    }

    private func pump() {
        guard !speaking, let e = engine.next(now: Date()) else { return }
        speaking = true
        Task {
            await VoiceSpeaker.shared.say(e)
            speaking = false
            pump()
        }
    }
}
