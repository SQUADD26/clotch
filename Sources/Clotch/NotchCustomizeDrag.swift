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
    /// On its black tile while carried and when it flies back to the palette; bare as it lands in the notch.
    var chip: Bool { !settling || target == .cancel }

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
        NotchElementSample(element: drag.element, chip: drag.chip)
            .scaleEffect(lifted ? 1.08 : 1)
            .shadow(color: .black.opacity(lifted ? 0.45 : 0), radius: lifted ? 12 : 0, y: lifted ? 6 : 0)
            .opacity(lifted && drag.target == .cancel ? 0.6 : 1)  // over nothing: release puts it back
            .position(drag.centre)
            .allowsHitTesting(false)
    }
}

/// Where the element will land: its ghost, exactly the size it will take, ringed; the neighbours moved aside.
struct NotchDropGap: View {
    let element: NotchElement

    var body: some View {
        NotchElementSample(element: element, chip: false).opacity(0.3)
            .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).strokeBorder(.white.opacity(0.8), lineWidth: 1.5).padding(-4))
            .spot(.gap)
    }
}

// MARK: - The drag on the sheet

extension NotchCustomizeView {
    /// The zones an element can go to, left to right: beside a hardware notch the centre is the gap.
    var zones: [NotchZone] { hasNotch ? [.left, .right] : [.left, .centre, .right] }

    var dragGesture: some Gesture {
        DragGesture(minimumDistance: 3, coordinateSpace: .named(NotchDrag.space))
            .onChanged { move(from: $0.startLocation, to: $0.location) }
            .onEnded { _ in dragEnded() }
    }

    /// A zone's elements as drawn: the carried one out (a palette tile over nothing leaves the notch as it was),
    /// nil where it would land.
    func cells(in zone: NotchZone) -> [NotchElement?] {
        let carried = drag.flatMap { drag -> NotchElement? in drag.origin == .cancel && drag.target == .cancel ? nil : drag.element }
        var cells: [NotchElement?] = layout.elements(in: zone).filter { $0 != carried }
        if let drag, case let .slot(at, index) = drag.target, zones[at] == zone { cells.insert(nil, at: min(index, cells.count)) }
        return cells
    }

    func spotsChanged(_ value: [NotchSpot: CGRect]) {
        spots = value
        if stillDrag && drag == nil { carryForStill() }
    }

    private func move(from start: CGPoint, to point: CGPoint) {
        if drag == nil {
            guard let picked = pick(at: start) else { return }
            let home = picked.frame
            let origin = target(for: picked.element, at: start, fromPalette: picked.fromPalette)
            drag = NotchDrag(element: picked.element, grab: CGSize(width: start.x - home.midX, height: start.y - home.midY),
                             home: home, origin: origin, point: point, target: origin)
        }
        guard var moved = drag, !moved.settling else { return }
        moved.point = point
        moved.target = target(for: moved.element, at: point, fromPalette: moved.origin == .cancel)
        drag = moved
    }

    /// `--gallery`: the last element on the right carried into the left zone, held a little below it.
    private func carryForStill() {
        guard let element = layout.elements(in: .right).last ?? layout.elements(in: .left).first,
              let from = spots[.item(element)], let left = spots[.zone(.left)] else { return }
        move(from: CGPoint(x: from.midX, y: from.midY), to: CGPoint(x: left.maxX - 4, y: left.midY + 10))
    }

    /// The element under `point`: one in a zone, or a palette tile (its sample is what lifts).
    private func pick(at point: CGPoint) -> (element: NotchElement, frame: CGRect, fromPalette: Bool)? {
        for element in NotchElement.allCases {
            if let frame = spots[.item(element)], frame.contains(point) { return (element, frame, false) }
            if spots[.tile(element)]?.contains(point) == true, let sample = spots[.sample(element)] { return (element, sample, true) }
        }
        return nil
    }

    /// A tile dropped back on the palette changes nothing, so from the palette it is not a drop target.
    private func target(for element: NotchElement, at point: CGPoint, fromPalette: Bool) -> NotchDrop {
        let measured = zones.map { zone in
            (frame: spots[.zone(zone)] ?? .zero,
             items: layout.elements(in: zone).filter { $0 != element }.compactMap { spots[.item($0)] })
        }
        return NotchReorder.drop(at: point, zones: measured, palette: fromPalette ? nil : spots[.palette])
    }

    /// Lands where the gap is (or flies home on a cancel), then saves with nothing left to move.
    private func dragEnded() {
        guard var released = drag, !released.settling else { return }
        let place: CGRect?
        switch released.target {
        case .remove: place = nil
        case .cancel: place = released.home; released.target = released.origin  // the gap reopens at home
        case .slot: place = spots[.gap] ?? released.home
        }
        guard let place, !reduceMotion else {
            withAnimation(reduceMotion ? nil : NotchMotion.spring) { apply(released); drag = nil }
            return
        }
        released.land(on: place)
        withAnimation(NotchMotion.spring, completionCriteria: .logicallyComplete) { drag = released } completion: {
            var still = Transaction()
            still.disablesAnimations = true
            withTransaction(still) { apply(released); drag = nil }
        }
    }

    private func apply(_ drag: NotchDrag) {
        switch drag.target {
        case let .slot(zone, index): edit { $0.place(drag.element, in: zones[zone], at: index, hasNotch: hasNotch) }
        case .remove: edit { $0.remove(drag.element); return true }
        case .cancel: break
        }
    }
}
