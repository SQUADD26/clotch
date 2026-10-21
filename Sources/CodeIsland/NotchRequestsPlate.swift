import SwiftUI
import CodeIslandCore

/// Roberto's requests: waiting ones on top, the ones taken in charge struck through.
struct RequestsPlate: View {
    let requests: [UserRequest]
    private static let shown = 6

    var body: some View {
        // Waiting first, then the ones taken in charge; newest first in each (GoalStore's order).
        let ordered = requests.filter { !$0.taken } + requests.filter(\.taken)
        let pending = requests.count - requests.filter(\.taken).count
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                PlateTitle("Richieste")
                Spacer(minLength: 8)
                if pending > 0 {
                    Text("\(pending) in attesa").font(.system(size: 11, weight: .medium)).foregroundStyle(GoalInk.secondary)
                }
            }
            if requests.isEmpty { EmptyLine("Nessuna richiesta") }
            ForEach(ordered.prefix(Self.shown)) { RequestLine(request: $0) }
            if ordered.count > Self.shown {
                Text("Altre \(ordered.count - Self.shown)")
                    .font(.system(size: 11))
                    .foregroundStyle(GoalInk.secondary)
                    .padding(.leading, 19)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassPlate(radius: 16)
    }
}

private struct RequestLine: View {
    let request: UserRequest

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Image(systemName: request.taken ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(request.taken ? GoalTone.go.color : GoalInk.secondary)
                .frame(width: 11)
            Text(request.text)
                .font(.system(size: 12, weight: request.taken ? .regular : .medium))
                .strikethrough(request.taken, color: GoalInk.secondary)
                .foregroundStyle(request.taken ? GoalInk.secondary : GoalInk.primary)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let at = request.takenAt ?? request.at {
                Text(Self.time(at))
                    .font(.system(size: 11).monospacedDigit())
                    .foregroundStyle(GoalInk.secondary)
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
