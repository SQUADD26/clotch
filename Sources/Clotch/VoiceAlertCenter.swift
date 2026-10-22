import Foundation
import os.log
import ClotchCore

/// Where the voice's news comes in (#57). With `~/.config/voce/eventi.jsonl` (claude-config#1854) only its new lines
/// count (#202: goals, requests and account limits are the engine's facts, Clotch never recomputes them); without it
/// Clotch derives only the end of a turn (a question for Roberto), merged PRs and the «Avvisami quando…» rules.
/// `VoiceAlertEngine` decides what is said; `VoiceSpeaker.say` says it, one at a time.
@MainActor
final class VoiceAlertCenter {
    static let shared = VoiceAlertCenter()
    private static let log = Logger(subsystem: "com.squadd.clotch", category: "Voice")

    private let files = VoiceFiles()
    private lazy var engine = VoiceAlertEngine(memory: try? Data(contentsOf: files.seenURL))
    private var speaking = false
    /// The last registers loaded, for the judge's state only.
    private var goals: [GoalRecord]?
    private var requests: [UserRequest]?
    private var eventsMark: VoiceEvents.Mark?
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

    /// New lines of eventi.jsonl (`VoiceStore` sees the file change). The first read only takes the mark: old news stays old.
    func eventsChanged() {
        guard let data = try? Data(contentsOf: files.eventsURL) else { eventsMark = nil; return }
        let read = VoiceEvents.newer(data, after: eventsMark)
        eventsMark = read.mark
        for type in read.unknown { Self.log.error("voice event not said: unknown type «\(type, privacy: .public)» in eventi.jsonl") }
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

    /// Every load of the goals and requests registers (`GoalStore`): kept for the judge, nothing is derived from them.
    func registersLoaded(goals next: [GoalRecord], requests nextRequests: [UserRequest]) {
        goals = next
        requests = nextRequests
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
        guard rules.contains(where: { !$0.fired && $0.when != nil }) else { return }
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
            // Re-read before writing: the page or `avvisami` may have changed the file meanwhile; only `stato` is set.
            try? files.modify(files.alertsURL, lock: "avvisi.lock") { VoiceAlertRule.firing(fired, in: $0) }
            offer(events)
        }
    }

    // MARK: Engine

    private func offer(_ events: [VoiceEvent]) {
        guard !events.isEmpty, files.isOn, files.key != nil else { return }
        Task {
            let sessions = await GoalStore.shared.allSessions()
            let config = VoiceTurn.Config((try? files.readConfig()) ?? [:])
            for e in events {
                guard let e = await judged(e) else { continue }
                _ = engine.offer(e, config: config, sessions: sessions, now: Date())
            }
            try? files.write(engine.memory, to: files.seenURL)  // survives a relaunch: the same subject is not said again
            pump()
        }
    }

    /// The Jev judge (`VoiceJudge`) for the kinds that can be noise; nil = it said no. Not reached: the fixed rules decide.
    private func judged(_ e: VoiceEvent) async -> VoiceEvent? {
        guard VoiceJudge.judges(e) else { return e }
        let v = await VoiceJudge.judge(state: VoiceJudge.state(e, requests: requests ?? [], goals: goals ?? []), key: files.jevKey,
                                       question: files.judgeQuestion) {
            try await URLSession.shared.data(for: $0).0
        }
        files.append(VoiceJudge.logLine(e, v, now: Date()), to: files.judgeLogURL)
        guard v.say != false else { return nil }
        var e = e
        e.judged = true
        return e
    }

    private func pump() {
        // The microphone is open: an alert said now would be heard and transcribed as Roberto's words (prove dal vivo 22/10).
        guard !VoiceInputController.shared.micOpen else { return retryWhenMicClosed() }
        guard !speaking, let e = engine.next(now: Date()) else { return }
        speaking = true
        Task {
            await VoiceSpeaker.shared.say(e)
            speaking = false
            pump()
        }
    }

    private var retrying = false

    private func retryWhenMicClosed() {
        guard !retrying else { return }
        retrying = true
        Task {
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            retrying = false
            pump()
        }
    }
}
