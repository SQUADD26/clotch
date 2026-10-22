// figma: 78-62944
import SwiftUI
import ClotchCore

private typealias T = FigmaToken.MacOS27GoldenGate

/// The ADHD tab when the engine's read failed and there is no list to show (claude-config#1967): never «Nessuna domanda».
/// It says the exact error and offers «Riprova». Drawn from Figma frame 78-62944.
struct AdhdReadFailed: View {
    let error: String
    var retry: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: T.notchSpazio6) {
            Text("Domande non caricate").font(.system(size: T.notchTesto14, weight: .semibold)).foregroundStyle(T.notchBianco)
            Text(error).font(.system(size: T.notchTesto12, weight: .medium)).foregroundStyle(T.notchBiancoA60)
                .fixedSize(horizontal: false, vertical: true)
                .lineSpacing(-T.notchSpazio1).padding(.bottom, -T.notchSpazio1)  // Figma's line is 14 tall, SwiftUI's 15: 14 per line
            Button { retry() } label: {
                Text("Riprova").font(.system(size: T.notchTesto11, weight: .semibold)).foregroundStyle(T.notchNero)
                    .padding(.horizontal, T.notchSpazio10).frame(height: T.notchMisura22)
                    .background(T.notchBiancoA94, in: RoundedRectangle(cornerRadius: T.notchRaggio11))
            }
            .buttonStyle(.notch)
            .padding(.top, T.notchSpazio4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
