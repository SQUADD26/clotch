// figma: 58-56113
import SwiftUI

private typealias T = FigmaToken.MacOS27GoldenGate

/// The bar of the open notch, from Figma frame 58-56113: four 103,5 × 30 tabs in a 422 well (padding 4), the chosen one
/// lifts; on the right the gear (36) and the AFK moon (38), 12 apart. One spring moves the highlight.
struct TabBar: View {
    @Binding var tab: NotchTab
    var tabs = NotchTab.allCases
    /// The tab with a yellow number, no box (new answers, #90, #114); never the open one.
    var badge: (tab: NotchTab, count: Int)? = nil
    /// The yellow number in the ADHD tab: the questions still without an answer (#123); nothing at 0.
    var adhdCount = 0
    /// The AFK moon's state for `--snapshot`; nil = live.
    var afkOn: Bool? = nil
    @Namespace private var highlight
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 0) {
            well
            Spacer(minLength: 0)
            // The gear and the AFK moon (#106) on the right of the bar, so they are there on every tab.
            HStack(spacing: T.notchSpazio12) {
                NotchSettingsButton()
                AfkButton(on: afkOn)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var well: some View {
        HStack(spacing: 0) {
            ForEach(tabs) { item in
                // withAnimation, so the notch's height follows the new tab with the same spring as the tab.
                Button { withAnimation(NotchMotion.animation(reduce: reduceMotion)) { tab = item } } label: {
                    HStack(spacing: T.notchSpazio6) {
                        Image(systemName: item.symbol)
                        Text(item.title)
                        if let count = number(for: item) {
                            Text("\(count.value)")
                                .font(.system(size: T.notchTesto11, weight: .semibold))
                                .foregroundStyle(T.notchGiallo)
                                .accessibilityLabel(count.label)
                        }
                    }
                    .font(.system(size: T.notchTesto13, weight: item == tab ? .semibold : .medium))
                    .foregroundStyle(item == tab ? T.notchBianco : T.notchBiancoA60)
                    .frame(width: T.notchMisura103_5, height: T.notchMisura30)
                    .background {
                        if item == tab {
                            Capsule().fill(T.notchBiancoA16).matchedGeometryEffect(id: "tab", in: highlight)
                        }
                    }
                    .contentShape(Capsule())
                }
                .buttonStyle(.notch)
                .accessibilityAddTraits(item == tab ? .isSelected : [])
            }
        }
        .padding(T.notchSpazio4)
        .frame(width: T.notchMisura422)
        .background(Capsule().fill(T.notchBiancoA7))
        .onHover { TabBarPointer.inside = $0 }
        .onDisappear { TabBarPointer.inside = false }  // closing the notch sends no hover-out
    }

    /// The yellow number beside a tab's title: new answers on Richieste (never on the open one), unanswered on ADHD.
    private func number(for item: NotchTab) -> (value: Int, label: String)? {
        if item == .adhd, adhdCount > 0 { return (adhdCount, "\(adhdCount) senza risposta") }
        if let badge, badge.tab == item, item != tab {
            return (badge.count, badge.count == 1 ? "1 nuova risposta" : "\(badge.count) nuove risposte")
        }
        return nil
    }
}
