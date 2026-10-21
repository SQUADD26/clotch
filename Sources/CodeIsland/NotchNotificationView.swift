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
            GlassGroup(spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: phase >= .settle ? note.symbol : note.startSymbol)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(note.color)
                        .contentTransition(.symbolEffect(.replace))
                        .frame(width: 34, height: 34)
                        .glassPlate(radius: 17, tint: note.color.opacity(0.28))
                        .glassID("symbol", in: glass)
                    if phase >= .reveal {
                        plate(note)
                            .glassID("plate", in: glass)
                            .transition(.opacity.combined(with: .scale(scale: 0.5, anchor: .leading)))
                    }
                }
                .frame(maxWidth: .infinity, alignment: phase >= .reveal ? .leading : .center)
            }
            .padding(.horizontal, 10)
            .padding(.top, 4)
            .padding(.bottom, 10)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(note.title + ". " + note.subtitle)
        }
    }

    private func plate(_ note: Note) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(note.title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(GoalInk.primary)
            if let row = note.row {
                HStack(spacing: 10) {
                    Text(note.subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(GoalInk.secondary)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    GoalBar(progress: phase >= .settle ? row.progress : note.before, tone: row.tone, height: 5)
                        .frame(width: 64)
                    if let proofs = row.proofsText {
                        Text(proofs)
                            .font(.system(size: 12, weight: .semibold).monospacedDigit())
                            .foregroundStyle(GoalInk.primary)
                            .fixedSize()
                    }
                }
            } else {
                StruckText(text: note.subtitle, drawn: phase >= .settle)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassPlate(radius: 14)
    }
}

/// The request text with a line drawn across it, left to right, once it is taken in charge.
private struct StruckText: View {
    let text: String
    let drawn: Bool

    var body: some View {
        Text(text)
            .font(.system(size: 12, weight: .medium))
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
        case .opened: title = "Obiettivo aperto"
        case .proofDone: title = "Prova fatta"
        case .still: title = "Obiettivo fermo"
        case .blocked: title = "Obiettivo bloccato"
        case .reached: title = "Obiettivo raggiunto"
        case .requestTaken: return nil
        }
        // The bar starts from the count before this proof, so the fill is the news.
        let before = event.kind == .proofDone && row.proofsTotal > 0
            ? Double(max(row.proofsDone - 1, 0)) / Double(row.proofsTotal) : row.progress
        self.init(title: title, subtitle: row.displayTitle, startSymbol: "circle",
                  symbol: event.kind == .proofDone ? "checkmark" : row.symbol, color: row.tone.color,
                  row: row, before: before)
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
