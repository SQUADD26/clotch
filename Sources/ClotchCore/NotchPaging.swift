import Foundation

/// Turns horizontal scroll events into page steps: one step per gesture, however strong the swipe.
/// A trackpad gesture steps once its travel passes `threshold`; the rest of it and its momentum
/// are swallowed. A mouse wheel (no phases) steps on the first click of a spin; the spin ends after
/// a `wheelGap` pause (or when the wheel turns back), however long or fast it was. Pure: the caller passes time.
public struct PageSwipe: Equatable, Sendable {
    public enum Phase: Sendable { case began, changed, ended, momentum, wheel }

    public static let threshold: Double = 24
    public static let wheelGap: TimeInterval = 0.2

    private var travel: Double = 0
    private var stepped = false
    private var lastWheel: Date?
    private var lastWheelDx: Double = 0

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
            defer { lastWheel = now; lastWheelDx = dx }  // every click extends the spin, so a fast one still steps once
            let turnedBack = lastWheelDx * dx < 0  // a reversal is a new gesture: no waiting for the pause
            guard turnedBack || lastWheel.map({ now.timeIntervalSince($0) >= Self.wheelGap }) ?? true else { return nil }
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

/// A trackpad drag of the pages, as on Apple's pagers: the content follows the fingers 1:1, resists past
/// the first and last page, and on release settles on the page that distance and speed point to, one page
/// at most. Offsets are in points, in the user's scrolling direction (negative = content moves left = next).
/// Pure: the caller passes time.
public struct PageDrag: Equatable, Sendable {
    /// How far a flick coasts, in seconds of its speed: UIScrollView's normal deceleration (0.998 per ms).
    public static let coast: Double = 0.998 / (1 - 0.998) / 1000
    /// A pause this long before lifting the fingers means the flick is over: no speed is carried.
    public static let hold: TimeInterval = 0.08

    public private(set) var travel: Double = 0
    /// Points per second, smoothed over the last events.
    public private(set) var velocity: Double = 0
    private var last: Date?

    public init(travel: Double = 0) { self.travel = travel }

    public mutating func move(dx: Double, at now: Date) {
        travel += dx
        if let last, now > last {
            let v = dx / now.timeIntervalSince(last)
            velocity = velocity == 0 ? v : 0.6 * v + 0.4 * velocity
        }
        last = now
    }

    /// The speed the release carries: none when the fingers rested before lifting.
    public func releaseVelocity(at now: Date) -> Double {
        guard let last, now.timeIntervalSince(last) < Self.hold else { return 0 }
        return velocity
    }

    /// The offset shown for `travel`: 1:1 within one page, a rubber band past the first or last page.
    public static func offset(travel: Double, index: Int, count: Int, width: Double) -> Double {
        guard width > 0 else { return 0 }
        let pastEdge = (travel > 0 && index <= 0) || (travel < 0 && index >= count - 1)
        guard pastEdge else { return max(-width, min(width, travel)) }
        // Apple's rubber band: (1 − 1 / (x·c / d + 1)) · d, c = 0.55; never more than a fraction of the width.
        let x = abs(travel)
        return (1 - 1 / (x * 0.55 / width + 1)) * width * (travel < 0 ? -1 : 1)
    }

    /// The page to settle on: where the content would coast to (offset + speed · `coast`) past half a page
    /// moves one page that way; the edges hold.
    public static func settle(index: Int, offset: Double, velocity: Double, width: Double, count: Int) -> Int {
        guard width > 0, count > 0 else { return index }
        let projected = offset + velocity * coast
        let step = abs(projected) > width / 2 ? (projected < 0 ? 1 : -1) : 0
        return min(max(index + step, 0), count - 1)
    }

    /// The release speed as a spring's initial velocity (fraction of `travel` per second). Only speed toward
    /// the page counts, capped, so a hard flick near the rest point never overshoots far.
    public static func springVelocity(_ velocity: Double, travel: Double) -> Double {
        guard travel != 0 else { return 0 }
        return min(max(velocity / travel, 0), 12)
    }
}

/// The spring that settles the pages, run by hand rather than by SwiftUI so that a new gesture can take it
/// where it is (#119): `offset` and `velocity` are always the pages' real place and speed. A drag starts
/// from `offset` (`PageDrag(travel:)`), a page turn in flight starts the next spring with `velocity`.
/// Offsets are in points, as in `PageDrag`; the rest place is 0.
public struct PageSpring: Equatable, Sendable {
    /// The notch's page spring (#52): 0.38 s, bounce 0.14.
    private static let omega = 2 * Double.pi / 0.38
    private static let damping = 1 - 0.14

    public private(set) var offset: Double
    public private(set) var velocity: Double

    public init(offset: Double = 0, velocity: Double = 0) {
        self.offset = offset
        self.velocity = velocity
    }

    public var isAtRest: Bool { offset == 0 && velocity == 0 }

    /// Runs the spring for `dt` seconds (small steps, so a slow frame stays stable); at rest it snaps to 0.
    public mutating func advance(by dt: TimeInterval) {
        var left = min(max(dt, 0), 0.1)
        while left > 0, !isAtRest {
            let h = min(left, 1.0 / 240)
            left -= h
            velocity += (-Self.omega * Self.omega * offset - 2 * Self.damping * Self.omega * velocity) * h
            offset += velocity * h
            if abs(offset) < 0.5, abs(velocity) < 5 { offset = 0; velocity = 0 }
        }
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
