import SwiftUI
import ClotchCore

/// What «Personalizza il notch» measures for the drag (#101), all in `NotchDrag.space`.
enum NotchSpot: Hashable {
    case zone(NotchZone), item(NotchElement), tile(NotchElement), sample(NotchElement), palette, gap
}

struct NotchSpotKey: PreferenceKey {
    static let defaultValue: [NotchSpot: CGRect] = [:]
    static func reduce(value: inout [NotchSpot: CGRect], nextValue: () -> [NotchSpot: CGRect]) {
        value.merge(nextValue()) { $1 }
    }
}

extension View {
    func spot(_ spot: NotchSpot) -> some View {
        background(GeometryReader { Color.clear.preference(key: NotchSpotKey.self, value: [spot: $0.frame(in: .named(NotchDrag.space))]) })
    }
}

/// The element under the pointer, as the Finder's toolbar customization: lifted, following the pointer.
struct NotchDrag {
    static let space = "notch-customize"
    let element: NotchElement
    let size: CGSize
    /// The pointer's offset from the element's centre, kept so the element does not jump under it.
    let grab: CGSize
    /// Where it was picked up, and the drop that puts it back there (`.cancel` from the palette).
    let home: CGRect
    let origin: NotchDrop
    var point: CGPoint
    var target: NotchDrop
    /// Released: flying to its place, no longer following the pointer.
    var settling = false

    var centre: CGPoint { CGPoint(x: point.x - grab.width, y: point.y - grab.height) }

    mutating func land(on rect: CGRect) {
        point = CGPoint(x: rect.midX + grab.width, y: rect.midY + grab.height)
        settling = true
    }
}

/// The lifted copy: a little larger with a shadow while it follows the pointer, flat again as it lands.
struct NotchDragPreview: View {
    let drag: NotchDrag

    var body: some View {
        let lifted = !drag.settling
        NotchElementSample(element: drag.element)
            .scaleEffect(lifted ? 1.08 : 1)
            .shadow(color: .black.opacity(lifted ? 0.45 : 0), radius: lifted ? 12 : 0, y: lifted ? 6 : 0)
            .opacity(lifted && drag.target == .cancel ? 0.6 : 1)  // over nothing: release puts it back
            .position(drag.centre)
            .allowsHitTesting(false)
    }
}

/// Where the element will land: a lit hollow capsule its size, the neighbours moved aside.
struct NotchDropGap: View {
    let size: CGSize

    var body: some View {
        Capsule().fill(.white.opacity(0.12))
            .overlay(Capsule().strokeBorder(.white.opacity(0.7), lineWidth: 1.5))
            .frame(width: size.width, height: size.height)
            .spot(.gap)
    }
}
