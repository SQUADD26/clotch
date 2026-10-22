// figma: 58-56113
import SwiftUI
import ClotchCore

private typealias T = FigmaToken.MacOS27GoldenGate

/// The ADHD tab (#123): Roberto's questions rewritten clear. Without an answer, the yellow line says who owes it and
/// «Sollecita» asks again; with an answer, the answer and how often it was asked. Drawn from Figma frame 58-56113.
struct AdhdTab: View {
    let items: [AdhdRequest]
    var error: String? = nil
    var markRead: (String?) -> Void = { _ in }
    var nudge: (String) -> Void = { _ in }

    var body: some View {
        VStack(alignment: .leading, spacing: T.notchSpazio18) {
            if let error {
                Text(error).font(.system(size: T.notchTesto12, weight: .semibold)).foregroundStyle(T.notchGiallo)
            }
            if items.contains(where: \.answered) {
                HStack {
                    Spacer(minLength: 0)
                    Button { markRead(nil) } label: {
                        Text("Segna tutte lette").font(.system(size: T.notchTesto11, weight: .semibold)).foregroundStyle(T.notchBiancoA60)
                            .frame(height: Line.header)
                    }
                    .buttonStyle(.notch)
                }
            }
            if items.isEmpty {
                EmptyState(text: "Nessuna domanda")
            } else {
                ForEach(items) { AdhdRow(item: $0, markRead: { markRead($0) }, nudge: nudge) }
            }
        }
    }
}

/// Line heights of the frame's text boxes (58:56150, 58:56153, 58:56154): one line each at least (a longer text wraps, #156), so a row is 35 tall.
private enum Line {
    static let header: CGFloat = 13, question: CGFloat = 17, detail: CGFloat = 14
}

private struct AdhdRow: View {
    let item: AdhdRequest
    let markRead: (String) -> Void
    let nudge: (String) -> Void
    @State private var hovering = false

    var body: some View {
        HStack(alignment: .top, spacing: T.notchSpazio16) {
            VStack(alignment: .leading, spacing: T.notchSpazio4) {
                Text(item.question).font(.system(size: T.notchTesto14, weight: .medium)).foregroundStyle(T.notchBiancoA92)
                    .fixedSize(horizontal: false, vertical: true).frame(minHeight: Line.question, alignment: .top)
                Group {
                    if item.answered {
                        Text(item.answer).font(.system(size: T.notchTesto12, weight: .medium)).foregroundStyle(T.notchBiancoA60)
                    } else {
                        Text(item.waitingLabel).font(.system(size: T.notchTesto12, weight: .semibold)).foregroundStyle(T.notchGiallo)
                    }
                }
                .fixedSize(horizontal: false, vertical: true).frame(minHeight: Line.detail, alignment: .top)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            trailing
        }
        .contentShape(Rectangle())
        .onHover { hovering = $0 }
    }

    @ViewBuilder private var trailing: some View {
        if item.answered {
            if hovering {
                Button("Segna letta") { markRead(item.id) }
                    .font(.system(size: T.notchTesto12, weight: .semibold)).foregroundStyle(T.notchBiancoA92).buttonStyle(.notch)
            } else if item.times > 1 {
                Text("×\(item.times)").font(.system(size: T.notchTesto11, weight: .medium)).foregroundStyle(T.notchBiancoA60)
            }
        } else if item.nudged {
            Text("Sollecitata").font(.system(size: T.notchTesto12, weight: .semibold)).foregroundStyle(T.notchGiallo)
        } else {
            Button("Sollecita") { nudge(item.id) }
                .font(.system(size: T.notchTesto12, weight: .semibold)).foregroundStyle(T.notchBiancoA92).buttonStyle(.notch)
        }
    }
}

extension AdhdRequest {
    /// The rows of Figma frame 58-56113 and of the gallery: two waiting (one to sort), three answered.
    static let samples: [AdhdRequest] = GoalSources.parseAdhd(Data("""
    [{"id":"Q-1","domanda_chiara":"Come riavvio il notch se si blocca?","responsabile":"Clotch","volte":1},
     {"id":"Q-2","domanda_chiara":"Quale account Claude uso per il CRM?","da_smistare":true,"volte":1},
     {"id":"Q-3","domanda_chiara":"Dove vedo i miei commenti su Figma?","risposta":"Nel file Clotch, pannello Commenti. Li controllo io a ogni giro.","volte":20},
     {"id":"Q-4","domanda_chiara":"Come porto una modifica in produzione?","risposta":"Si lavora su dev. Main lo promuove la sessione madre.","volte":4},
     {"id":"Q-5","domanda_chiara":"Cosa è rimasto aperto su Clotch?","risposta":"Tre pull request aspettano il verde. Un disegno aspetta la tua approvazione.","volte":2}]
    """.utf8))
}
