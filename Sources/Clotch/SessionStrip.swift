// figma: 58:56709
import SwiftUI
import ClotchCore

// The strip above the goals (clotch#114, Figma «Stato delle sessioni»): one name per goal, coloured by what its
// session does (grey works, yellow waits for Roberto, red has a problem), the summary on the right, and under the
// name the mouse is on, why. No dots, no bars: the colour of the name is the state.

private typealias T = FigmaToken.MacOS27GoldenGate

extension SessionTone {
    var ink: Color {
        switch self {
        case .quiet: T.notchBiancoA60
        case .attention: T.notchGiallo
        case .problem: T.notchRosso
        }
    }

    /// The wash under a name the mouse is on.
    var wash: Color {
        switch self {
        case .quiet: T.notchBiancoA7
        case .attention: T.notchGialloA18
        case .problem: T.notchRossoA18
        }
    }

    var summaryInk: Color { self == .quiet ? T.notchBiancoA55 : ink }
}

struct SessionStrip: View {
    struct Entry: Identifiable {
        let id: String
        let name: String
        let tone: SessionTone
        /// The pager pages this name stands for; a click goes to the first.
        let pages: Range<Int>
        /// What the mouse-over line says; nil for a quiet session.
        let line: String?
    }

    let entries: [Entry]
    let index: Int
    let summary: (text: String, tone: SessionTone)
    let go: (Int) -> Void
    @State private var hovered: String?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: T.notchSpazio6) {
            HStack(spacing: 0) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: T.notchSpazio2) {
                        ForEach(entries) { entry in name(entry) }
                    }
                }
                Spacer(minLength: T.notchSpazio8)
                Text(summary.text)
                    .font(.system(size: T.notchTesto11, weight: .semibold))
                    .foregroundStyle(summary.tone.summaryInk)
                    .lineLimit(1)
                    .fixedSize()
            }
            if let line = entries.first(where: { $0.id == hovered })?.line {
                Text(line)
                    .font(.system(size: T.notchTesto12, weight: .medium))
                    .foregroundStyle(T.notchBiancoA92)
                    .lineLimit(1)
                    .transition(.opacity)
            }
        }
        .animation(NotchMotion.animation(reduce: reduceMotion), value: hovered)
    }

    private func name(_ entry: Entry) -> some View {
        let on = hovered == entry.id || entry.pages.contains(index)
        return Button { go(entry.pages.lowerBound) } label: {
            Text(entry.name)
                .font(.system(size: T.notchTesto12, weight: entry.tone == .quiet ? .medium : .semibold))
                .foregroundStyle(entry.tone.ink)
                .lineLimit(1)
                .padding(.horizontal, T.notchSpazio8)
                .padding(.vertical, T.notchSpazio3)
                .background(RoundedRectangle(cornerRadius: T.notchRaggio6).fill(on ? entry.tone.wash : .clear))
                .contentShape(RoundedRectangle(cornerRadius: T.notchRaggio6))
        }
        .buttonStyle(.plain)
        .onHover { inside in
            if inside { hovered = entry.id } else if hovered == entry.id { hovered = nil }
        }
        .accessibilityLabel(entry.line ?? entry.name)
    }
}
