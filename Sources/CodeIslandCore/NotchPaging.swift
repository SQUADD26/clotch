import Foundation

/// Turns horizontal scroll events into page steps: one step per gesture, however strong the swipe.
/// A trackpad gesture steps once its travel passes `threshold`; the rest of it and its momentum
/// are swallowed. A mouse wheel (no phases) steps once per `wheelGap`. Pure: the caller passes time.
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
            guard dx != 0, lastWheel.map({ now.timeIntervalSince($0) >= Self.wheelGap }) ?? true else { return nil }
            lastWheel = now
            return dx < 0 ? 1 : -1
        }
        guard !stepped, abs(travel) >= Self.threshold else { return nil }
        stepped = true
        // Fingers moving left (negative delta) bring the next page in, as on every Mac pager.
        return travel < 0 ? 1 : -1
    }
}
