import AppKit
import Combine
import SwiftUI
import CodeIslandCore

/// The steps of one notification in the closed notch. Each step is a still frame,
/// so `--snapshot` can draw the animation frame by frame.
enum NotePhase: Int, CaseIterable, Comparable {
    case arrive   // the island opens and the glass drop falls out of the notch
    case reveal   // the drop splits into the symbol and the text plate
    case settle   // the change lands: strike drawn, bar filled, symbol replaced

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
    private var lastRequests: [UserRequest] = []
    private var primedUntil = Date.distantFuture
    private var bag: Set<AnyCancellable> = []
    private var draining = false

    func start(store: GoalStore = .shared) {
        guard bag.isEmpty else { return }
        // shortcut: what loads in the first 3 s is the baseline, not news; a first load slower
        // than that would be announced once. Upgrade if GoalStore ever exposes "first load done".
        primedUntil = Date().addingTimeInterval(3)
        store.$rows.sink { [weak self] rows in Task { @MainActor in self?.take(rows: rows) } }.store(in: &bag)
        store.$requests.sink { [weak self] list in Task { @MainActor in self?.take(requests: list) } }.store(in: &bag)
    }

    private var priming: Bool { Date() < primedUntil }

    private func take(rows: [GoalRow]) {
        defer { lastRows = rows }
        if !priming { enqueue(NotchEvents.goals(old: lastRows, new: rows)) }
    }

    private func take(requests: [UserRequest]) {
        defer { lastRequests = requests }
        if !priming { enqueue(NotchEvents.requests(old: lastRequests, new: requests)) }
    }

    private func enqueue(_ events: [NotchEvent]) {
        // The same change never notifies twice, even if a file flickers back and forth.
        queue += events.filter { seen.insert($0.id).inserted }
        guard !draining, !queue.isEmpty else { return }
        draining = true
        Task { await drain() }
    }

    private func drain() async {
        defer { draining = false }
        while !queue.isEmpty {
            let event = queue.removeFirst()
            let still = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
            phase = still ? .settle : .arrive
            withAnimation(still ? .easeOut(duration: 0.2) : NotchAnimation.open) { current = event }
            if !still {
                await pause(0.38)
                withAnimation(.spring(response: 0.42, dampingFraction: 0.8)) { phase = .reveal }
                await pause(0.42)
                withAnimation(.easeOut(duration: 0.55)) { phase = .settle }
            }
            await pause(3.4)
            withAnimation(still ? .easeOut(duration: 0.2) : NotchAnimation.close) { current = nil }
            await pause(0.45)
        }
    }

    private func pause(_ seconds: Double) async {
        try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
    }
}
