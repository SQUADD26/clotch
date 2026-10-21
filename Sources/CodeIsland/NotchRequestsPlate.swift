import SwiftUI
import CodeIslandCore

/// The Requests tab: the requests no session has taken in charge yet, 5 per page. A taken one leaves the list.
struct RequestsTab: View {
    let requests: [UserRequest]
    /// False until the requests register exists on this Mac.
    let active: Bool
    @State private var page: Int
    static let perPage = 5

    init(requests: [UserRequest], active: Bool, startPage: Int = 0) {
        self.requests = UserRequest.waiting(requests)
        self.active = active
        _page = State(initialValue: startPage)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                IconLabel(symbol: "tray", text: "Richieste")
                Spacer()
                if !requests.isEmpty {
                    Text("\(requests.count) in attesa")
                        .font(NotchType.label)
                        .foregroundStyle(GoalInk.secondary)
                }
            }
            if requests.isEmpty {
                EmptyState(text: "Nessuna richiesta in attesa", detail: active ? nil : "Arrivano con il prossimo aggiornamento.")
            } else {
                let pages = (requests.count + Self.perPage - 1) / Self.perPage
                let index = Binding<Int>(get: { min(page, pages - 1) }, set: { page = $0 })
                Pager(count: pages, index: index) { p in
                    // Every page is as tall as a full one, so the footer never jumps.
                    VStack(alignment: .leading, spacing: 12) {  // rows 32 pt apart
                        ForEach(requests.dropFirst(p * Self.perPage).prefix(Self.perPage)) { RequestLine(request: $0) }
                    }
                    .frame(minHeight: CGFloat(Self.perPage) * 20 + CGFloat(Self.perPage - 1) * 12, alignment: .top)
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
                    Text("\(index + 1) di \(pages)").font(NotchType.label).foregroundStyle(Color.white.opacity(0.5))
                }
                .buttonStyle(.plain)
                .font(NotchType.caption)
                .foregroundStyle(Color.white.opacity(0.75))
            }
        }
    }
}

private struct RequestLine: View {
    let request: UserRequest

    var body: some View {
        HStack(spacing: 12) {
            RequestMark(taken: false)
            Text(request.text)
                .font(NotchType.line)
                .foregroundStyle(GoalInk.row)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("In attesa")
                .font(NotchType.small)
                .foregroundStyle(GoalInk.quiet)
        }
        .frame(height: 20)
        .help(request.original)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(request.text + ". In attesa")
    }
}

/// A request's mark: a green circle with a dark check once taken, a thin white circle while it waits.
struct RequestMark: View {
    let taken: Bool

    var body: some View {
        Group {
            if taken {
                Image(systemName: "checkmark.circle.fill")
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(GoalInk.check, GoalTone.go.color)
                    .font(.system(size: 16))
            } else {
                Circle().stroke(Color.white.opacity(0.42), lineWidth: 1.5).frame(width: 15, height: 15)
            }
        }
        .frame(width: 16, height: 16)
    }
}
