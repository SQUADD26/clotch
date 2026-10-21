import SwiftUI
import CodeIslandCore

/// Roberto's requests: waiting ones on top, the ones taken in charge struck through.
struct RequestsPlate: View {
    let requests: [UserRequest]
    /// False until the requests register exists on this Mac.
    let active: Bool
    private static let shown = 6

    var body: some View {
        // Waiting first, then the ones taken in charge; newest first in each (GoalStore's order).
        let ordered = requests.filter { !$0.taken } + requests.filter(\.taken)
        let pending = requests.filter { !$0.taken }.count
        Plate(title: "Richieste") {
            if pending > 0 {
                Text("\(pending) in attesa").font(NotchType.caption).foregroundStyle(GoalInk.secondary)
            }
        } content: {
            if requests.isEmpty {
                EmptyState(text: "Nessuna richiesta", detail: active ? nil : "Arrivano con il prossimo aggiornamento.")
            } else {
                VStack(alignment: .leading, spacing: NotchSpace.row) {
                    ForEach(ordered.prefix(Self.shown)) { RequestLine(request: $0) }
                    if ordered.count > Self.shown {
                        Text("Altre \(ordered.count - Self.shown)")
                            .font(NotchType.caption)
                            .foregroundStyle(GoalInk.secondary)
                            .padding(.leading, RequestLine.indent)
                    }
                }
            }
        }
    }
}

private struct RequestLine: View {
    let request: UserRequest
    /// Mark column + spacing.
    static let indent: CGFloat = 12 + NotchSpace.row

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: NotchSpace.row) {
            Image(systemName: request.taken ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(request.taken ? GoalTone.go.color : GoalInk.secondary)
                .frame(width: 12)
            Text(request.text)
                .font(request.taken ? NotchType.body : NotchType.bodyEmphasis)
                .strikethrough(request.taken, color: GoalInk.secondary)
                .foregroundStyle(request.taken ? GoalInk.secondary : GoalInk.primary)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let at = request.takenAt ?? request.at {
                Text(Self.time(at)).font(NotchType.caption.monospacedDigit()).foregroundStyle(GoalInk.secondary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(request.text + (request.taken ? ". Presa in carico" : ". In attesa"))
    }

    static func time(_ date: Date) -> String {
        Calendar.current.isDateInToday(date)
            ? date.formatted(.dateTime.hour().minute())
            : date.formatted(.dateTime.day().month(.abbreviated))
    }
}
