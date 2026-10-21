import Foundation
#if canImport(CoreGraphics)
import CoreGraphics
#endif

/// Where a dragged element of «Personalizza il notch» lands, given the pointer (#101). One rule for every
/// zone, as in the Finder's toolbar customization: inside the zones' band the nearest zone takes it, at
/// the slot its items' middles give; over the palette it leaves the notch; anywhere else it goes back.
public enum NotchDrop: Equatable, Sendable {
    /// `zone` is the index in the frames passed; `index` counts the zone's items without the dragged one.
    case slot(zone: Int, index: Int)
    case remove
    case cancel
}

public enum NotchReorder {
    /// How far above or below the zones the pointer may stray and still drop into one.
    public static let bandSlop: CGFloat = 24

    /// `zones`: each usable zone's frame and the frames of its items left to right, the dragged one left out.
    /// The gap between two zones goes to the nearer one, so the mark never flickers off between them.
    public static func drop(at point: CGPoint, zones: [(frame: CGRect, items: [CGRect])], palette: CGRect?) -> NotchDrop {
        let band = zones.map(\.frame).reduce(CGRect.null) { $0.union($1) }
        if !band.isNull, point.y >= band.minY - bandSlop, point.y <= band.maxY + bandSlop,
           point.x >= band.minX, point.x <= band.maxX {
            let zone = zones.indices.min { distance(point.x, zones[$0].frame) < distance(point.x, zones[$1].frame) }!
            return .slot(zone: zone, index: zones[zone].items.filter { $0.midX < point.x }.count)
        }
        if palette?.contains(point) == true { return .remove }
        return .cancel
    }

    private static func distance(_ x: CGFloat, _ frame: CGRect) -> CGFloat {
        x < frame.minX ? frame.minX - x : x > frame.maxX ? x - frame.maxX : 0
    }
}
