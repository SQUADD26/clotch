import SwiftUI
import ClotchCore

/// The Requests tab: what the engine leaves open (`UserRequest.listed`, #199), 5 per page, with the engine's state.
/// Under each text its `punto` (#90, #199); a question waits as «In attesa di risposta». A taken task leaves the list.
struct RequestsTab: View {
    let requests: [UserRequest]
    /// False until the requests register exists on this Mac.
    let active: Bool
    @State private var page: Int
    /// When the tab was opened last, frozen at first show: the dots stay while Roberto reads, go at the next opening.
    @State private var seenAt: Date
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    static let perPage = 5

    init(requests: [UserRequest], active: Bool, now: Date = Date(), seenAt: Date = .distantFuture, startPage: Int = 0) {
        self.requests = UserRequest.listed(requests, now: now)
        _seenAt = State(initialValue: seenAt)
        self.active = active
        _page = State(initialValue: startPage)
    }

    private var openCount: Int { UserRequest.waiting(requests).count }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                IconLabel(symbol: "tray", text: "Richieste")
                Spacer()
                if openCount > 0 {
                    Text("\(openCount) in attesa")
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
                    let shown = requests.dropFirst(p * Self.perPage).prefix(Self.perPage)
                    // Every page is as tall as a full one, so the footer never jumps.
                    VStack(alignment: .leading, spacing: 12) {  // rows 32 pt apart
                        ForEach(shown) { RequestLine(request: $0, isNew: $0.isNewAnswer(since: seenAt)).transition(.notchRow(reduce: reduceMotion)) }
                    }
                    .animation(NotchMotion.animation(reduce: reduceMotion), value: shown.map(\.id))
                    .frame(minHeight: CGFloat(Self.perPage) * 20 + CGFloat(Self.perPage - 1) * 12, alignment: .top)
                } footer: { go in
                    if pages > 1 { footer(pages: pages, index: index.wrappedValue, go: go) }
                }
            }
        }
        .onAppear { GoalStore.shared.markAnswersSeen() }
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
                .buttonStyle(.notch)
                .font(NotchType.caption)
                .foregroundStyle(Color.white.opacity(0.75))
            }
        }
    }
}

struct RequestLine: View {
    let request: UserRequest
    let isNew: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 12) {
                Text(request.text)
                    .font(NotchType.line)
                    .strikethrough(request.look.struck, color: GoalInk.quiet)
                    .foregroundStyle(GoalInk.row)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(request.statusLabel)
                    .font(NotchType.small)
                    .foregroundStyle(request.look.color)
            }
            .frame(minHeight: 20, alignment: .top)  // wraps, never «…» (#156)
            if !request.point.isEmpty {
                Text(request.point)
                    .font(NotchType.small)
                    .foregroundStyle(GoalInk.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .fixedSize(horizontal: false, vertical: true)  // never squeezed under a capped height (#301)
        .help(request.original)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(request.text + ". " + request.statusLabel + (isNew ? ", nuova risposta" : "")
                            + (request.point.isEmpty ? "" : ". " + request.point))
    }
}

extension UserRequest.Look {
    /// The colour of `ink` (#67): yellow while at work, green only once done.
    var color: Color {
        switch ink {
        case .quiet: GoalInk.quiet
        case .wait: GoalTone.wait.color
        case .stop: GoalTone.stop.color
        case .go: GoalTone.go.color
        }
    }
}

/// A request's mark in a notification (#39, #114): an hourglass while it waits, a pulsing arrow while a session works
/// on it, a green check once done. Never a dot or a circle.
struct RequestMark: View {
    let look: UserRequest.Look
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Group {
            switch look {
            case .working:
                Image(systemName: "arrow.triangle.2.circlepath")
                    .foregroundStyle(look.color)
                    .symbolEffect(.pulse, options: .repeating, isActive: !reduceMotion)
            case .done:
                Image(systemName: "checkmark").fontWeight(.semibold).foregroundStyle(look.color)
            default:
                Image(systemName: "hourglass").foregroundStyle(GoalInk.quiet)
            }
        }
        .font(.system(size: 14))
        .frame(width: 16, height: 16)
    }
}
