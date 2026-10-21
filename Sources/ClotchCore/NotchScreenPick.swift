import Foundation
#if canImport(CoreGraphics)
import CoreGraphics // macOS: CGRect.minX/maxX live in the CoreGraphics overlay, Foundation alone does not bring them
#endif

/// Which screen the notch belongs to, in Cocoa screen coordinates (origin bottom-left, y up). Pure: tested on Linux (#35).
public enum NotchScreenPick {
    /// The pointer is on `frame`. NSEvent.mouseLocation runs over (minY, maxY]: on the top row y == maxY,
    /// where CGRect.contains says no, and on a screen stacked above y == its minY, where it says yes.
    public static func isOn(_ point: CGPoint, _ frame: CGRect) -> Bool {
        point.x >= frame.minX && point.x < frame.maxX && point.y > frame.minY && point.y <= frame.maxY
    }

    /// Screen under the pointer; a pointer in no screen (a gap, a stale position) takes the nearest one. nil only with no screens.
    public static func index(of point: CGPoint, in frames: [CGRect]) -> Int? {
        if let index = frames.firstIndex(where: { isOn(point, $0) }) { return index }
        return frames.indices.min { distance(point, frames[$0]) < distance(point, frames[$1]) }
    }

    /// CGWindowList bounds (origin top-left of the primary screen, y down) to Cocoa coordinates.
    public static func cocoaRect(fromQuartz rect: CGRect, primaryHeight: CGFloat) -> CGRect {
        CGRect(x: rect.minX, y: primaryHeight - rect.maxY, width: rect.width, height: rect.height)
    }

    private static func distance(_ point: CGPoint, _ frame: CGRect) -> CGFloat {
        let dx = max(frame.minX - point.x, 0, point.x - frame.maxX)
        let dy = max(frame.minY - point.y, 0, point.y - frame.maxY)
        return dx * dx + dy * dy
    }
}
