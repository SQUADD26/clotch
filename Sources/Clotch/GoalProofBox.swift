// figma: 78-62682
import SwiftUI

private typealias T = FigmaToken.MacOS27GoldenGate

/// «Prova da confermare» (#237): a proof with no command, which only Roberto can tick, under the goal's sessions line.
/// «Conferma» ticks it in the register; if the engine refuses, the box turns red (frame 78-62810) and «Riprova» asks again.
/// The text wraps and is never cut. Drawn from Figma frames 78-62682 (waiting) and 78-62810 (not saved).
struct GoalProofBox: View {
    let text: String
    /// «1 di 2» when more than one proof waits; the first not done is shown.
    var position: (n: Int, of: Int) = (1, 1)
    /// The engine's last line when it refused; nil = nothing failed.
    var failure: String?
    var confirm: () -> Void = {}

    var body: some View {
        let failed = failure != nil
        HStack(alignment: .center, spacing: T.notchSpazio16) {
            VStack(alignment: .leading, spacing: T.notchSpazio2) {
                Text(label).font(.system(size: T.notchTesto11, weight: failed ? .semibold : .medium))
                    .foregroundStyle(failed ? T.notchRosso : T.notchBiancoA60).frame(height: labelHeight, alignment: .bottom)
                Text(failed ? failure ?? "" : text).font(.system(size: T.notchTesto13, weight: .medium)).foregroundStyle(T.notchBiancoA92)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: confirm) {
                Text(failed ? "Riprova" : "Conferma").font(.system(size: T.notchTesto11, weight: .semibold)).foregroundStyle(T.notchNero)
                    .padding(.bottom, T.notchSpazio2)  // the glyphs sit 1 px higher in the frame's 13 px text box than in SwiftUI's 14 px line
                    .padding(.horizontal, T.notchSpazio10).frame(height: T.notchMisura22)
                    .background(T.notchBiancoA94, in: RoundedRectangle(cornerRadius: T.notchRaggio11))
            }
            .buttonStyle(.notch)
        }
        .padding(.horizontal, T.notchSpazio16).padding(.vertical, T.notchSpazio8)
        .frame(maxWidth: .infinity)
        .background(failed ? T.notchRossoA18 : T.notchBiancoA7, in: RoundedRectangle(cornerRadius: T.notchRaggio10))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(failed ? "Conferma non salvata. \(failure ?? "")" : "\(label). \(text)")
    }

    /// Height of the text box of an 11 pt line in the frames (78:62684): SwiftUI's own line for 11 pt is 14, so the box would be 48, not 47.
    private let labelHeight: CGFloat = 13

    private var label: String {
        failure != nil ? "Conferma non salvata" : position.of > 1 ? "Prova da confermare · \(position.n) di \(position.of)" : "Prova da confermare"
    }
}
