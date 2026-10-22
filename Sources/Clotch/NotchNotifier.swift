import AppKit
import Combine
import SwiftUI
import ClotchCore
import os

private let log = Logger(subsystem: ClotchLog.subsystem, category: "NotchNotifier")

/// The steps of one notification in the closed notch. Each step is a still frame,
/// so `--snapshot` can draw the animation frame by frame.
enum NotePhase: Int, CaseIterable, Comparable {
    case arrive   // the line opens under the notch in its old state
    case settle   // the change lands: struck through, ring filled, label and colour turned
    case leave    // the line folds back; only the result symbol stays in the notch

    static func < (a: NotePhase, b: NotePhase) -> Bool { a.rawValue < b.rawValue }
}

/// Turns changes in GoalStore into notifications, one at a time: goal changes and requests taken in charge.
@MainActor final class NotchNotifier: ObservableObject {
    static let shared = NotchNotifier()

    @Published private(set) var current: NotchEvent?
    @Published private(set) var phase: NotePhase = .arrive

    private var queue: [NotchEvent] = []
    private var seen = Set<String>()
    private var lastRows: [GoalRow] = []
    private var primedUntil = Date.distantFuture
    private var bag: Set<AnyCancellable> = []
    private var lastSteps: [String: HeartbeatSteps.Step] = [:]
    // shortcut: the engine's default folder only; read CODA_OVERSEER_DIR too if Clotch is ever launched with it.
    static let stepsFile = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".config/coda-overseer/battito/passi.json")
    private var draining = false
    /// True while the pointer is on the island: a notification under it stays until the pointer leaves.
    var pointerOver = false

    func start(store: GoalStore = .shared) {
        guard bag.isEmpty else { return }
        // shortcut: what loads in the first 3 s is the baseline, not news; a first load slower
        // than that would be announced once. Upgrade if GoalStore ever exposes "first load done".
        primedUntil = Date().addingTimeInterval(3)
        store.$rows.sink { [weak self] rows in Task { @MainActor in self?.take(rows: rows) } }.store(in: &bag)
        // GoalStore already keeps the baseline for requests and hands over only the fresh ones.
        store.$takenToAnimate.sink { [weak self] ids in Task { @MainActor in self?.take(taken: ids) } }.store(in: &bag)
        stepsChanged()
    }

    /// The Friday heartbeat's steps (#184); VoiceStore's ~/.config stream calls it when the file changes.
    func stepsChanged() {
        guard let steps = (try? Data(contentsOf: Self.stepsFile)).flatMap(HeartbeatSteps.parse) else { return }
        defer { lastSteps = steps }
        let stuck = HeartbeatSteps.stuck(old: lastSteps, new: steps)
        for e in stuck { log.error("passo del battito fermo: \(e.subject, privacy: .public): \(steps[e.subject]?.error ?? "", privacy: .public)") }
        enqueue(stuck)
    }

    private var priming: Bool { Date() < primedUntil }

    private func take(rows: [GoalRow]) {
        defer { lastRows = rows }
        if !priming { enqueue(NotchEvents.goals(old: lastRows, new: rows)) }
    }

    private func take(taken ids: [String]) {
        enqueue(ids.map { NotchEvent(kind: .requestTaken, subject: $0, count: 0) })
    }

    private func enqueue(_ events: [NotchEvent]) {
        // The same change never notifies twice, even if a file flickers back and forth.
        var fresh = events.filter { seen.insert($0.id).inserted }
        if !(UserDefaults.standard.object(forKey: ClotchPrefs.notes) as? Bool ?? ClotchPrefs.notesDefault) {  // «Mostra avvisi» off (#56)
            fresh.filter { $0.kind == .requestTaken }.forEach { GoalStore.shared.takenAnimationShown($0.subject) }
            fresh = []
        }
        queue = NotchEvents.merge(queue: queue, adding: fresh)
        guard !draining, !queue.isEmpty else { return }
        draining = true
        Task { await drain() }
    }

    private func drain() async {
        defer { draining = false }
        while !queue.isEmpty {
            let event = queue.removeFirst()
            // One spring for every step; Reduce Motion: the result at once, fades only.
            let still = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
            let motion = NotchMotion.animation(reduce: still)
            phase = still ? .settle : .arrive
            withAnimation(motion) { current = event }
            if !still {
                await pause(0.9)
                withAnimation(motion) { phase = .settle }
            }
            let (rows, requests) = (GoalStore.shared.rows, GoalStore.shared.requests)
            // The longer of the notch's notice and the full line under it: the line is no longer clipped (#102).
            let text = [event.notice(rows: rows, requests: requests), Note(event: event, rows: rows, requests: requests)?.text]
                .compactMap { $0 }.max { $0.count < $1.count } ?? ""
            await pause(NotchEvents.hold(forText: text) * ClotchPrefs.noteScale(UserDefaults.standard.string(forKey: ClotchPrefs.noteLength) ?? ""))
            while pointerOver { await pause(0.25) }
            if event.kind == .requestTaken { GoalStore.shared.takenAnimationShown(event.subject) }
            withAnimation(motion) { phase = .leave }
            await pause(1.0)
            withAnimation(motion) { current = nil }
            await pause(0.4)
        }
    }

    private func pause(_ seconds: Double) async {
        try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
    }
}
