import Foundation
import CodeIslandCore

// Pure paging logic of the «Obiettivi» tab: no view, no AppKit, so a test can drive it.

/// Which goal page shows. One step moves exactly one page and never leaves 0...count-1.
struct GoalPager: Equatable {
    let count: Int
    private(set) var page: Int

    init(count: Int, page: Int = 0) {
        self.count = max(count, 0)
        self.page = min(max(page, 0), max(count - 1, 0))
    }

    var canBack: Bool { page > 0 }
    var canForward: Bool { page < count - 1 }

    /// `delta` is +1 (next) or -1 (previous); false when the edge stops it.
    @discardableResult
    mutating func step(_ delta: Int) -> Bool {
        let next = page + (delta > 0 ? 1 : -1)
        guard (0..<count).contains(next) else { return false }
        page = next
        return true
    }

    /// The goal chased now first, the rest in the board's order.
    static func ordered(_ rows: [GoalRow]) -> [GoalRow] {
        guard let hero = rows.hero else { return rows }
        return [hero] + rows.filter { $0.id != hero.id }
    }
}

/// One swipe = one page, however strong. The first push past `threshold` steps; the rest of that
/// gesture, and the momentum the trackpad adds after the fingers lift, only count as «spent».
/// A mouse wheel has no phases: one step per click, at most one per `cooldown`.
struct GoalSwipe {
    static let threshold: CGFloat = 12
    static let cooldown: TimeInterval = 0.3
    /// A gap this long with no event starts a new gesture even if the end event was lost.
    static let gap: TimeInterval = 0.4

    private var sum: CGFloat = 0
    private var spent = false
    private var lastEvent: TimeInterval = -.infinity
    private var lastStep: TimeInterval = -.infinity

    /// `step` is +1 / -1 / 0; `consumed` says the event belongs to the swipe and must not scroll anything else.
    mutating func feed(dx: CGFloat, dy: CGFloat, ended: Bool, momentum: Bool, precise: Bool,
                       time: TimeInterval) -> (step: Int, consumed: Bool) {
        if ended { sum = 0; spent = false; lastEvent = time; return (0, false) }
        if time - lastEvent > Self.gap { sum = 0; spent = false }
        lastEvent = time
        if momentum { return (0, spent) }
        guard abs(dx) > abs(dy) else { return (0, false) }
        // Fingers moving left (dx < 0) bring the next page, like turning a page.
        let direction = dx < 0 ? 1 : -1
        if !precise {
            guard time - lastStep >= Self.cooldown else { return (0, true) }
            lastStep = time
            return (direction, true)
        }
        sum += dx
        guard !spent, abs(sum) >= Self.threshold else { return (0, true) }
        spent = true
        return (sum < 0 ? 1 : -1, true)
    }
}
