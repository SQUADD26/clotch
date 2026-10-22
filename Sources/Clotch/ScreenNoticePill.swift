// figma: 93-65567
import SwiftUI
import ClotchCore

/// The line under the notch before a script takes the screen (clotch#292), as drawn in Figma: «Uso lo schermo» with a bar that
/// empties and a counter that steps every 100 ms, then «Schermo libero» with a check. Same black as the notch notes.
struct ScreenNoticePill: View {
    let phase: ScreenNotice.Phase
    /// A still picture (the parity render): the clock is this date, nothing ticks.
    var still: Date? = nil
    private typealias T = FigmaToken.MacOS27GoldenGate
    /// The pill is 458 wide in the drawing (`notch/misura/458`).
    static let width = FigmaToken.MacOS27GoldenGate.notchMisura458

    var body: some View {
        VStack(alignment: .leading, spacing: T.notchSpazio1) {
            switch phase {
            case .incoming(let deadline, let total): incoming(deadline: deadline, total: total)
            case .free: row(Image(systemName: "checkmark").font(.system(size: T.notchTesto14, weight: .bold)).foregroundStyle(T.notchVerde), "Schermo libero")
            }
        }
        .padding(.horizontal, T.notchAvvisoMargine)
        .padding(.top, T.notchSpazio9)
        .padding(.bottom, T.notchSpazio6)
        .frame(maxWidth: .infinity, minHeight: T.notchSpazio42, alignment: .topLeading)
        .accessibilityElement(children: .combine)
    }

    private func row<Trailing: View>(_ mark: some View, _ title: String, @ViewBuilder trailing: () -> Trailing = { EmptyView() }) -> some View {
        HStack(spacing: T.notchSpazio10) {
            mark.frame(width: T.notchAvvisoIcona)
            Text(title).font(.system(size: T.notchTesto14, weight: .semibold)).foregroundStyle(T.notchBianco).lineLimit(1)
            Spacer(minLength: T.notchSpazio8)
            trailing()
        }
        .frame(minHeight: T.notchMisura22)
    }

    @ViewBuilder private func incoming(deadline: Date, total: TimeInterval) -> some View {
        if let still {
            countdown(left: min(total, max(0, deadline.timeIntervalSince(still))), total: total)
        } else {
            TimelineView(.periodic(from: deadline.addingTimeInterval(-total), by: T.attesaAvvisoPasso)) { context in
                countdown(left: min(total, max(0, deadline.timeIntervalSince(context.date))), total: total)
            }
        }
    }

    private func countdown(left: TimeInterval, total: TimeInterval) -> some View {
        VStack(alignment: .leading, spacing: T.notchSpazio1) {
            row(Image(systemName: "display").font(.system(size: T.notchTesto14)).foregroundStyle(T.notchAvvisoSchermo), "Uso lo schermo") {
                Text(Self.counter(left)).font(.system(size: T.notchTesto14, weight: .semibold)).monospacedDigit().foregroundStyle(T.notchAvvisoSchermo)
            }
            GeometryReader { bar in
                Capsule().fill(T.notchBiancoA12)
                Capsule().fill(T.notchAvvisoSchermo).frame(width: bar.size.width * (total > 0 ? left / total : 0))
            }
            .frame(height: T.notchAvvisoBarraAltezza)
        }
    }

    /// «1,5 s»: tenths, rounded up so the last step reads 0,1 s and the bar and the number end together.
    static func counter(_ left: TimeInterval) -> String {
        String(format: "%.1f", (left * 10).rounded(.up) / 10).replacingOccurrences(of: ".", with: ",") + " s"
    }
}

/// The purple light on the notch's outline while the countdown runs; none for «Schermo libero».
struct ScreenNoticeLight<S: Shape>: View {
    let phase: ScreenNotice.Phase?
    let shape: S
    private typealias T = FigmaToken.MacOS27GoldenGate

    var body: some View {
        ZStack {
            if case .incoming? = phase {
                shape.stroke(T.notchAvvisoSchermoA90, lineWidth: T.notchSpazio3)
                    .background(shape.stroke(T.notchAvvisoSchermoA60, lineWidth: T.notchSpazio9).blur(radius: T.notchSpazio10))
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: phase == nil)
        .allowsHitTesting(false)
    }
}
