import SwiftUI
import CodeIslandCore

/// One notification under the closed notch. A glass drop falls out of the notch (arrive), splits into
/// the symbol and a text plate (reveal), then the change lands (settle): the request is struck through
/// by a drawn line, or the goal's bar fills to its new proof count, and the symbol turns into the result.
struct NotchNotificationView: View {
    let event: NotchEvent
    let phase: NotePhase
    let rows: [GoalRow]
    let requests: [UserRequest]
    @Namespace private var glass

    var body: some View {
        if let note = Note(event: event, rows: rows, requests: requests) {
            // 8 pt in from the island's 24 pt corners: 16 pt plates, concentric. The symbol drop is a
            // circle as tall as the plate, so the two read as one shape splitting in two.
            GlassGroup(spacing: NotchSpace.inset) {
                HStack(spacing: NotchSpace.inset) {
                    Image(systemName: phase >= .settle ? note.symbol : note.startSymbol)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(note.color)
                        .contentTransition(.symbolEffect(.replace))
                        .frame(width: 48, height: 48)
                        .glassPlate(radius: 24, tint: note.color.opacity(0.28))
                        .glassID("symbol", in: glass)
                    if phase >= .reveal {
                        plate(note)
                            .glassID("plate", in: glass)
                            .transition(.opacity.combined(with: .scale(scale: 0.5, anchor: .leading)))
                    }
                }
                .frame(maxWidth: .infinity, alignment: phase >= .reveal ? .leading : .center)
            }
            .padding([.horizontal, .bottom], NotchSpace.inset)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(note.title + ". " + note.subtitle)
        }
    }

    private func plate(_ note: Note) -> some View {
        VStack(alignment: .leading, spacing: NotchSpace.tight) {
            Text(note.title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(GoalInk.primary)
            if let row = note.row {
                HStack(spacing: NotchSpace.row) {
                    Text(note.subtitle)
                        .font(NotchType.secondary)
                        .foregroundStyle(GoalInk.secondary)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    GoalBar(progress: phase >= .settle ? row.progress : note.before, tone: row.tone, height: 5)
                        .frame(width: 64)
                    if let proofs = row.proofsText {
                        Text(proofs)
                            .font(NotchType.numbers)
                            .foregroundStyle(GoalInk.primary)
                            .fixedSize()
                    }
                }
            } else {
                StruckText(text: note.subtitle, drawn: phase >= .settle)
            }
        }
        .padding(.horizontal, NotchSpace.plate)
        .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
        .glassPlate(radius: NotchSpace.radius)
    }
}

/// The request text with a line drawn across it, left to right, once it is taken in charge.
private struct StruckText: View {
    let text: String
    let drawn: Bool

    var body: some View {
        Text(text)
            .font(NotchType.secondary.weight(.medium))
            .foregroundStyle(drawn ? GoalInk.secondary : GoalInk.primary)
            .lineLimit(1)
            .overlay {
                GeometryReader { geo in
                    Capsule()
                        .fill(Color.white.opacity(0.85))
                        .frame(width: drawn ? geo.size.width : 0, height: 1.5)
                        .offset(y: geo.size.height / 2 - 0.75)
                }
            }
    }
}

/// What a notification says, read from the live data at display time.
private struct Note {
    let title: String
    let subtitle: String
    let startSymbol: String
    let symbol: String
    let color: Color
    let row: GoalRow?
    let before: Double?

    init?(event: NotchEvent, rows: [GoalRow], requests: [UserRequest]) {
        if event.kind == .requestTaken {
            guard let request = requests.first(where: { $0.id == event.subject }) else { return nil }
            self.init(title: "Richiesta presa in carico", subtitle: request.text, startSymbol: "circle",
                      symbol: "checkmark", color: GoalTone.go.color, row: nil, before: nil)
            return
        }
        guard let row = rows.first(where: { $0.id == event.subject }) else { return nil }
        let title: String
        switch event.kind {
        case .proofDone: title = "Prova fatta"
        case .still: title = "Obiettivo fermo"
        case .blocked: title = "Obiettivo bloccato"
        case .reached: title = "Obiettivo raggiunto"
        case .requestTaken: return nil
        }
        // The bar starts from the count before this proof, so the fill is the news.
        let before = event.kind == .proofDone && row.proofsTotal > 0
            ? Double(max(row.proofsDone - 1, 0)) / Double(row.proofsTotal) : row.progress
        // A goal's shape is its state from the first frame; only a request turns from open circle to check.
        let symbol = event.kind == .proofDone ? "checkmark" : row.symbol
        self.init(title: title, subtitle: row.title, startSymbol: symbol, symbol: symbol,
                  color: row.tone.color, row: row, before: before)
    }

    private init(title: String, subtitle: String, startSymbol: String, symbol: String, color: Color,
                 row: GoalRow?, before: Double?) {
        self.title = title
        self.subtitle = subtitle
        self.startSymbol = startSymbol
        self.symbol = symbol
        self.color = color
        self.row = row
        self.before = before
    }
}
