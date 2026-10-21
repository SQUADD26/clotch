import SwiftUI
import CodeIslandCore

/// The Requests tab: Roberto's requests, 5 per page, struck through once a session takes them in charge.
struct RequestsTab: View {
    let requests: [UserRequest]
    /// False until the requests register exists on this Mac.
    let active: Bool
    @State private var page: Int
    static let perPage = 5

    init(requests: [UserRequest], active: Bool, startPage: Int = 0) {
        self.requests = requests
        self.active = active
        _page = State(initialValue: startPage)
    }

    var body: some View {
        let taken = requests.filter(\.taken).count
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                IconLabel(symbol: "tray", text: "Richieste")
                Spacer()
                if !requests.isEmpty {
                    Text("\(requests.count) in tutto · \(taken) \(taken == 1 ? "presa" : "prese") in carico")
                        .font(NotchType.label)
                        .foregroundStyle(GoalInk.secondary)
                }
            }
            if requests.isEmpty {
                EmptyState(text: "Nessuna richiesta", detail: active ? nil : "Arrivano con il prossimo aggiornamento.")
            } else {
                let pages = (requests.count + Self.perPage - 1) / Self.perPage
                let index = Binding<Int>(get: { min(page, pages - 1) }, set: { page = $0 })
                Pager(count: pages, index: index) { p in
                    // Every page is as tall as a full one, so the footer never jumps.
                    VStack(alignment: .leading, spacing: 14) {
                        ForEach(requests.dropFirst(p * Self.perPage).prefix(Self.perPage)) { RequestLine(request: $0) }
                    }
                    .frame(minHeight: CGFloat(Self.perPage) * 20 + CGFloat(Self.perPage - 1) * 14, alignment: .top)
                } footer: { go in
                    if pages > 1 { footer(pages: pages, index: index.wrappedValue, go: go) }
                }
            }
        }
    }

    private func footer(pages: Int, index: Int, go: @escaping (Int) -> Void) -> some View {
        VStack(spacing: 12) {
            Rectangle().fill(GoalInk.divider).frame(height: 0.5)
            ZStack {
                PageControl(count: pages, index: index, go: go)
                HStack {
                    if index == 0 {
                        let rest = requests.count - Self.perPage
                        Button { go(1) } label: {
                            HStack(spacing: 4) { Text("Altre \(rest)"); Image(systemName: "chevron.right") }
                        }
                    } else {
                        Button { go(0) } label: {
                            HStack(spacing: 4) { Image(systemName: "chevron.left"); Text("Prime \(Self.perPage)") }
                        }
                    }
                    Spacer()
                    Text("\(index + 1) di \(pages)").font(NotchType.label).foregroundStyle(GoalInk.secondary)
                }
                .buttonStyle(.plain)
                .font(NotchType.caption)
                .foregroundStyle(GoalInk.primary)
            }
        }
    }
}

private struct RequestLine: View {
    let request: UserRequest

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: request.taken ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 15))
                .foregroundStyle(request.taken ? GoalTone.go.color : GoalInk.secondary)
            Text(request.text)
                .font(NotchType.body)
                .strikethrough(request.taken, color: GoalInk.secondary)
                .foregroundStyle(request.taken ? GoalInk.secondary : GoalInk.primary)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(request.taken ? "Presa in carico" : "In attesa")
                .font(request.taken ? NotchType.caption : NotchType.label)
                .foregroundStyle(request.taken ? GoalTone.go.color : GoalInk.secondary)
        }
        .frame(height: 20)
        .help(request.original)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(request.text + (request.taken ? ". Presa in carico" : ". In attesa"))
    }
}
