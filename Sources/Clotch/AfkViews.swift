import AppKit
import SwiftUI
import ClotchCore

/// AFK's colours (Figma «✅ Scelta definitiva · AFK»): indigo like macOS «Non disturbare».
enum AfkInk {
    static let moon = Color(red: 125 / 255, green: 122 / 255, blue: 1)       // #7d7aff
    static let on = Color(red: 94 / 255, green: 92 / 255, blue: 230 / 255)   // #5e5ce6
    static let blocked = Color(red: 1, green: 159 / 255, blue: 10 / 255)     // #ff9f0a
    static let pr = Color(red: 191 / 255, green: 140 / 255, blue: 1)         // #bf8cff
}

/// The moon beside the tab bar: «Attiva AFK» / «Disattiva AFK». `on` nil = the live state.
struct AfkButton: View {
    var on: Bool? = nil
    @ObservedObject private var store = AfkStore.shared

    var body: some View {
        let lit = on ?? store.isOn
        let label = lit ? "Disattiva AFK" : "Attiva AFK"
        Button { store.set(!lit) } label: {
            Image(systemName: "moon.fill")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(lit ? Color.white : GoalInk.off)
                .frame(width: 38, height: 38)
                .background(Circle().fill(lit ? AfkInk.on : GoalInk.well))
                .contentShape(Circle())
        }
        .buttonStyle(.notchSmall)
        .help(label)
        .accessibilityLabel(label)
    }
}

/// AFK on, in the bar: the moon and how many things got done; open, also the words.
struct AfkSign: View {
    let count: Int
    let expanded: Bool

    var body: some View {
        let done = count == 1 ? "1 cosa fatta" : "\(count) cose fatte"
        HStack(spacing: 4) {
            Image(systemName: "moon.fill").font(.system(size: 9, weight: .semibold)).foregroundStyle(AfkInk.moon).frame(width: 12, height: 12)
            if expanded {
                Text("AFK · \(done)")
            } else if count > 0 {
                Text("\(count)")
            }
        }
        .font(NotchType.small.monospacedDigit())
        .foregroundStyle(GoalInk.off)
        .lineLimit(1)
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("AFK, \(done)")
    }
}

/// «Mentre eri via»: the sentence, then the work grouped by title, each thing with its time, kind and text.
/// Above ~550 pt the list scrolls under the sentence, with a thin bar always on its right.
struct AfkSummaryView: View {
    let report: AfkReport
    var maxHeight: CGFloat = 520
    var animated = true
    var dismiss: () -> Void = { AfkStore.shared.dismiss() }

    /// 552 − the 32 pt bar, as in the Figma.
    static let tallest: CGFloat = 520
    @State private var content: CGFloat = 0
    @State private var offset: CGFloat = 0
    @State private var shown = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if report.groups.isEmpty { empty } else { full }
        }
        .padding(.horizontal, NotchSpace.side)
        .padding(.top, 14)
        .padding(.bottom, 20)
        .onAppear { shown = true }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Image(systemName: "moon.fill").font(.system(size: 13, weight: .semibold)).foregroundStyle(AfkInk.moon).frame(width: 16, height: 16)
            Text("Mentre eri via").font(.system(size: 16, weight: .semibold)).foregroundStyle(GoalInk.primary)
            Spacer(minLength: 8)
            Text(report.heading).font(NotchType.label).foregroundStyle(GoalInk.secondary)
        }
    }

    private var sentence: some View {
        Text(report.sentence).font(NotchType.bodyEmphasis).foregroundStyle(GoalInk.strong).lineSpacing(4)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var close: some View {
        Button(action: dismiss) {
            Text("Chiudi").font(NotchType.caption).foregroundStyle(GoalInk.primary)
                .frame(width: 64, height: 26).background(Capsule().fill(Color.white.opacity(0.14)))
        }
        .buttonStyle(.notchSmall)
    }

    private var empty: some View {
        VStack(spacing: 0) {
            header
            sentence.multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.top, 31)
            Rectangle().fill(GoalInk.divider).frame(height: 1).padding(.top, 18)
            close.padding(.top, 12)
        }
    }

    private var full: some View {
        AfkColumn(tallest: min(maxHeight, Self.tallest) - 14 - 20) {
            VStack(alignment: .leading, spacing: 0) {
                header
                sentence.padding(.top, 9)
                Rectangle().fill(GoalInk.divider).frame(height: 1).padding(.top, 14)
            }
            .padding(.bottom, 14)
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 22) {
                    ForEach(Array(report.groups.enumerated()), id: \.element.id) { i, group in
                        AfkGroupView(group: group)
                            .opacity(shown || !animated ? 1 : 0)
                            .offset(y: shown || !animated ? 0 : 6)
                            .animation(animated ? NotchMotion.spring.delay(Double(min(i, 8)) * 0.04) : nil, value: shown)
                    }
                }
                .padding(.bottom, 12)
                .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("afkList")) } action: {
                    content = $0.height
                    offset = -$0.minY
                }
            }
            .coordinateSpace(name: "afkList")
            .overlay(alignment: .topTrailing) {
                GeometryReader { box in
                    if content > box.size.height + 1 { scrollBar(visible: box.size.height) }
                }
                .frame(width: 3)
                .offset(x: 12)
            }
            VStack(spacing: 0) {
                Rectangle().fill(GoalInk.divider).frame(height: 1).padding(.top, 2)
                HStack { Spacer(); close }.padding(.top, 12)
            }
        }
    }

    /// 3 pt, always there when the list is longer than its room: where you are in it.
    private func scrollBar(visible: CGFloat) -> some View {
        let thumb = max(24, visible * visible / max(content, 1))
        let travel = max(1, content - visible)
        return Capsule().fill(Color.white.opacity(0.06)).frame(width: 3, height: visible)
            .overlay(alignment: .top) {
                Capsule().fill(Color.white.opacity(0.4)).frame(width: 3, height: thumb)
                    .offset(y: (visible - thumb) * min(1, max(0, offset / travel)))
            }
    }
}

/// The sentence block and «Chiudi» at their size; the list between them as tall as it wants, up to what `tallest` leaves.
private struct AfkColumn: Layout {
    let tallest: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? NotchSize.open - 2 * NotchSpace.side
        return CGSize(width: width, height: heights(width, subviews).reduce(0, +))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for (view, height) in zip(subviews, heights(bounds.width, subviews)) {
            view.place(at: CGPoint(x: bounds.minX, y: y), proposal: ProposedViewSize(width: bounds.width, height: height))
            y += height
        }
    }

    private func heights(_ width: CGFloat, _ views: Subviews) -> [CGFloat] {
        let natural = views.map { $0.sizeThatFits(ProposedViewSize(width: width, height: nil)).height }
        guard natural.count == 3 else { return natural }
        return [natural[0], min(natural[1], max(80, tallest - natural[0] - natural[2])), natural[2]]
    }
}

/// One work: the area chip, the title, «Apri sessione»; under it the session and how many things; then the things.
private struct AfkGroupView: View {
    let group: AfkGroup

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                if let chip = group.chip {
                    HStack(spacing: 3) {
                        if !chip.icon.isEmpty { Text(chip.icon) }
                        Text(chip.area)
                    }
                    .font(NotchType.smallEmphasis).foregroundStyle(Color.white.opacity(0.85))
                    .padding(.horizontal, 8).frame(height: 20)
                    .background(RoundedRectangle(cornerRadius: 6, style: .continuous).fill(GoalInk.button))
                }
                Text(group.title).font(.system(size: 14, weight: .semibold)).foregroundStyle(GoalInk.primary).lineLimit(1)
                Spacer(minLength: 8)
                let target = SessionTarget(localId: group.localId, profile: "")
                if target.url != nil {
                    AfkLink(text: "Apri sessione") { SessionOpener.open(target) }
                }
            }
            Text(group.subtitle).font(NotchType.label).foregroundStyle(GoalInk.secondary).padding(.top, 6)
            VStack(alignment: .leading, spacing: 10) {
                ForEach(group.items) { AfkItemRow(item: $0) }
            }
            .padding(.top, 9)
        }
    }
}

private struct AfkItemRow: View {
    let item: AfkItem
    private static let clock: DateFormatter = { let f = DateFormatter(); f.dateFormat = "HH:mm"; return f }()

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            Text(Self.clock.string(from: Date(timeIntervalSince1970: item.t)))
                .font(NotchType.label.monospacedDigit()).foregroundStyle(Color.white.opacity(0.5))
                .frame(width: 46, alignment: .leading)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(item.kind).font(NotchType.caption).foregroundStyle(color)
                    Spacer(minLength: 8)
                    if let label = item.linkLabel, let url = URL(string: item.link) {
                        AfkLink(text: label) { NSWorkspace.shared.open(url) }
                    }
                }
                Text(item.testo).font(NotchType.bodyEmphasis).foregroundStyle(Color.white.opacity(0.85)).lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.trailing, 18)
            }
        }
    }

    private var color: Color {
        switch item.tipo {
        case "richiesta_fatta", "obiettivo_raggiunto": return GoalTone.go.color
        case "obiettivo_bloccato": return AfkInk.blocked
        case "pr_unita": return AfkInk.pr
        default: return GoalInk.off
        }
    }
}

/// «Apri sessione», «PR #105»: the words and a small arrow out.
private struct AfkLink: View {
    let text: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(text).font(NotchType.caption).foregroundStyle(Color.white.opacity(0.7))
                Image(systemName: "arrow.up.right").font(.system(size: 8, weight: .bold)).foregroundStyle(Color.white.opacity(0.5))
                    .frame(width: 14, height: 14)
            }
        }
        .buttonStyle(.notchSmall)
    }
}
