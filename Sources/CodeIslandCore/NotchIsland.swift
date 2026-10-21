import Foundation

/// Where the island sits inside the notch window. The window never moves or resizes, so the island
/// is a column centred in it and hung from its top: as the width and height animate, the top edge
/// and the centre stay put and the island grows straight down and out to both sides (#33).
public enum NotchIslandGeometry {
    public static func column(in rect: CGRect, width: CGFloat) -> CGRect {
        CGRect(x: rect.midX - width / 2, y: rect.minY, width: width, height: rect.height)
    }
}
