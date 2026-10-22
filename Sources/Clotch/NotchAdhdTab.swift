// figma: 78-62299
import SwiftUI
import ClotchCore

private typealias T = FigmaToken.MacOS27GoldenGate

/// The ADHD tab (#123, #158): Roberto's questions rewritten clear. Without an answer, the yellow line says who owes it and
/// «Sollecita» asks again. An answer shows on one line; under the pointer (or when another session asks, `AdhdStore.focus`) the row
/// opens: whole answer, how often it was asked, «Rimuovi». A removed answer leaves like a merged PR, then «Annulla» for 3 s.
/// A failed read shows why, with «Riprova», never «Nessuna domanda». Frames 78-62299 (open row), 78-62538 (removed), 78-62856 (error).
struct AdhdTab: View {
    let items: [AdhdRequest]
    var markRead: (String?) -> Void
    var nudge: (String) -> Void
    @ObservedObject private var store: AdhdStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(items: [AdhdRequest], markRead: @escaping (String?) -> Void = { _ in }, nudge: @escaping (String) -> Void = { _ in },
         store: AdhdStore = .shared) {
        self.items = items; self.markRead = markRead; self.nudge = nudge; _store = ObservedObject(wrappedValue: store)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: T.notchSpazio18) {
            if let failure = store.failure {
                AdhdFailureCard(message: failure.message, retry: store.refresh)
            } else {
                if items.contains(where: \.answered) {
                    HStack {
                        Spacer(minLength: 0)
                        Button { markRead(nil) } label: {
                            Text("Rimuovi risposte").font(.system(size: T.notchTesto11, weight: .semibold)).foregroundStyle(T.notchBiancoA60)
                                .frame(height: Line.header)
                        }
                        .buttonStyle(.notch)
                    }
                }
                if items.isEmpty && store.removal == nil {
                    EmptyState(text: "Nessuna domanda")
                }
                ForEach(items) { item in
                    AdhdRow(item: item, focused: store.focus == item.question, markRead: { markRead($0) }, nudge: nudge,
                            enter: { if store.focus != item.question { store.focus = nil } })
                        .transition(.notchRow(reduce: reduceMotion))  // the PR rows' way out (#100)
                }
                if let removal = store.removal {
                    HStack(spacing: T.notchSpazio16) {
                        Text(removal.rows.count > 1 ? "Risposte rimosse" : "Risposta rimossa")
                            .font(.system(size: T.notchTesto12, weight: .medium)).foregroundStyle(T.notchBiancoA60)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Button { store.undoRemoval() } label: { Pill(text: "Annulla · \(removal.left)", fill: T.notchBiancoA12, ink: T.notchBiancoA92) }
                            .buttonStyle(.notchSmall)
                    }
                    .transition(.opacity)
                }
            }
        }
        .animation(NotchMotion.animation(reduce: reduceMotion), value: items.map(\.id))
        .animation(NotchMotion.animation(reduce: reduceMotion), value: store.removal != nil)
    }
}

/// «Domande non caricate»: the exact error and the button that reads again (frame 78-62856).
private struct AdhdFailureCard: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: T.notchSpazio6) {
            Text("Domande non caricate").font(.system(size: T.notchTesto14, weight: .semibold)).foregroundStyle(T.notchBianco)
            Text(message).font(.system(size: T.notchTesto12, weight: .medium)).foregroundStyle(T.notchBiancoA60)
                .fixedSize(horizontal: false, vertical: true)
            Button(action: retry) { Pill(text: "Riprova", fill: T.notchBiancoA94, ink: T.notchNero) }
                .buttonStyle(.notchSmall).padding(.top, T.notchSpazio4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The 22 pt button of the frames: «Rimuovi», «Annulla · 3», «Riprova».
private struct Pill: View {
    let text: String
    let fill: Color
    let ink: Color

    var body: some View {
        Text(text).font(.system(size: T.notchTesto11, weight: .semibold)).foregroundStyle(ink)
            .padding(.horizontal, T.notchSpazio10).frame(height: T.notchMisura22)
            .background(RoundedRectangle(cornerRadius: T.notchRaggio11).fill(fill))
    }
}

/// Line heights of the frame's text boxes (58:56150, 58:56153, 58:56154): one line each at least, so a closed row is 35 tall.
private enum Line {
    static let header: CGFloat = 13, question: CGFloat = 17, detail: CGFloat = 14
}

extension View {
    /// Every line of the text in a box of `height`, as in the frame (12 pt text sets 15 pt lines by default, the frame's box is 14).
    /// shortcut: before macOS 26 the lines keep the default height, a pixel or two taller per line.
    @ViewBuilder func lineBox(_ height: CGFloat) -> some View {
        if #available(macOS 26, *) { lineHeight(.exact(points: height)) } else { self }
    }
}

private struct AdhdRow: View {
    let item: AdhdRequest
    let focused: Bool
    let markRead: (String) -> Void
    let nudge: (String) -> Void
    let enter: () -> Void
    @State private var hovering = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Only an answer has more to show.
    private var open: Bool { item.answered && (hovering || focused) }

    var body: some View {
        HStack(alignment: .top, spacing: T.notchSpazio16) {
            VStack(alignment: .leading, spacing: T.notchSpazio4) {
                Text(item.question).font(.system(size: T.notchTesto14, weight: .medium)).foregroundStyle(T.notchBiancoA92)
                    .fixedSize(horizontal: false, vertical: true).frame(minHeight: Line.question, alignment: .top)
                if item.answered {
                    Text(item.answer).font(.system(size: T.notchTesto12, weight: .medium)).foregroundStyle(T.notchBiancoA60)
                        .lineLimit(open ? nil : 1).lineBox(Line.detail).fixedSize(horizontal: false, vertical: true)
                } else {
                    Text(item.waitingLabel).font(.system(size: T.notchTesto12, weight: .semibold)).foregroundStyle(T.notchGiallo)
                        .fixedSize(horizontal: false, vertical: true).frame(minHeight: Line.detail, alignment: .top)
                }
                if open {
                    Text(item.times == 1 ? "Chiesta 1 volta" : "Chiesta \(item.times) volte")
                        .font(.system(size: T.notchTesto11, weight: .medium)).foregroundStyle(T.notchBiancoA60).lineBox(Line.header)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            trailing
        }
        .padding(.horizontal, open ? T.notchSpazio16 : 0).padding(.vertical, open ? T.notchSpazio12 : 0)
        .background(RoundedRectangle(cornerRadius: T.notchRaggio14).fill(open ? T.notchBiancoA7 : .clear))
        .contentShape(Rectangle())
        .onHover { hovering = $0; if $0 { enter() } }
    }

    @ViewBuilder private var trailing: some View {
        if item.answered {
            if open {
                Button { markRead(item.id) } label: { Pill(text: "Rimuovi", fill: T.notchBiancoA12, ink: T.notchBiancoA92) }
                    .buttonStyle(.notchSmall)
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
    /// The rows of Figma frame 78-62299 and of the gallery: two waiting (one to sort), three answered.
    static let samples: [AdhdRequest] = GoalSources.parseAdhd(Data("""
    [{"id":"Q-1","domanda_chiara":"Come riavvio il notch se si blocca?","responsabile":"Clotch","volte":1},
     {"id":"Q-2","domanda_chiara":"Quale account Claude uso per il CRM?","da_smistare":true,"volte":1},
     {"id":"Q-3","domanda_chiara":"Dove vedo i miei commenti su Figma?","risposta":"Nel file Clotch, pannello Commenti in alto a destra. Li leggo io a ogni giro: quelli fatti li segno risolti e in chat ti dico cosa ho cambiato.","volte":20},
     {"id":"Q-4","domanda_chiara":"Come porto una modifica in produzione?","risposta":"Si lavora su dev. Main lo promuove la sessione madre.","volte":4},
     {"id":"Q-5","domanda_chiara":"Cosa è rimasto aperto su Clotch?","risposta":"Tre pull request aspettano il verde: dettatura, scheda Richieste e scheda ADHD. Un disegno aspetta la tua approvazione.","volte":2}]
    """.utf8))
}
