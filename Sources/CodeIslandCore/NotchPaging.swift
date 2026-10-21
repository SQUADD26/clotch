import Foundation

/// Turns horizontal scroll events into page steps: one step per gesture, however strong the swipe.
/// A trackpad gesture steps once its travel passes `threshold`; the rest of it and its momentum
/// are swallowed. A mouse wheel (no phases) steps on the first click of a spin; the spin ends after
/// a `wheelGap` pause, however long or fast it was. Pure: the caller passes time.
public struct PageSwipe: Equatable, Sendable {
    public enum Phase: Sendable { case began, changed, ended, momentum, wheel }

    public static let threshold: Double = 24
    public static let wheelGap: TimeInterval = 0.35

    private var travel: Double = 0
    private var stepped = false
    private var lastWheel: Date?

    public init() {}

    /// `dx` in the user's scrolling direction (NSEvent.scrollingDeltaX). Returns +1 (next), -1 (previous) or nil.
    public mutating func feed(dx: Double, phase: Phase, at now: Date) -> Int? {
        switch phase {
        case .began:
            travel = dx
            stepped = false
        case .changed:
            travel += dx
        case .ended, .momentum:
            return nil
        case .wheel:
            guard dx != 0 else { return nil }
            defer { lastWheel = now }  // every click extends the spin, so a fast one still steps once
            guard lastWheel.map({ now.timeIntervalSince($0) >= Self.wheelGap }) ?? true else { return nil }
            return dx < 0 ? 1 : -1
        }
        guard !stepped, abs(travel) >= Self.threshold else { return nil }
        stepped = true
        // Fingers moving left (negative delta) bring the next page in, as on every Mac pager.
        return travel < 0 ? 1 : -1
    }

    /// `index + step` when it is one of `count` pages, else nil: the edges do not wrap or overshoot.
    public static func target(from index: Int, step: Int, count: Int) -> Int? {
        let target = index + step
        return (0..<count).contains(target) ? target : nil
    }
}

/// Which page dots to draw: at most `limit`, sliding with the page so the current one stays in view.
public enum PageDots {
    public static func window(count: Int, index: Int, limit: Int = 4) -> Range<Int> {
        let size = min(count, limit)
        let start = min(max(0, index - size / 2), count - size)
        return start..<(start + size)
    }
}
