import AppKit
import SwiftUI
import ClotchCore

/// `Clotch --snapshot <dir> [--gallery]`: renders the real notch from the live data to PNG (2x)
/// and quits. Without `--gallery`: closed and open (Goals). With it: every Figma state the live data
/// can produce now, named like the Figma frames (01-riposo …); a state the data cannot produce is
/// skipped and said. It is how the notch is checked where screen capture is not allowed. Real data only.
@MainActor
enum GoalSnapshot {
    /// A 14/16" MacBook notch, in points.
    private static let notchWidth: CGFloat = 185  // 14" MacBook Pro, as in the Figma
    private static let notchHeight: CGFloat = 32
    private static let openWidth = NotchSize.open
    private static let window = NotchWidth.window(screenWidth: 1512)  // 14" MacBook Pro
    /// Stand-in for the menu bar and desktop around the island, so its black shape reads.
    private static let surround = Color(white: 0.24)

    static func requestedDirectory() -> URL? {
        let args = CommandLine.arguments
        guard let i = args.firstIndex(of: "--snapshot"), i + 1 < args.count else { return nil }
        return URL(fileURLWithPath: args[i + 1], isDirectory: true)
    }

    static func run(into dir: URL) {
        let store = GoalStore.shared
        store.loadNow()
        AccountQuotaFeed.shared.loadNow()
        AccountsInUseFeed.shared.start()
        var failed = false
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            func save<V: View>(_ view: V, _ name: String) throws {
                try write(view, to: dir.appendingPathComponent("clotch-\(name).png"))
            }
            func closed(_ fraction: Double) -> CGFloat {  // the panel's own closed width (NotchLayoutMetrics), on a 14" screen
                var layout = NotchScreenLayout.standard(hasNotch: true)
                layout.width = fraction
                return NotchLayoutMetrics.closedWidth(layout, hasNotch: true, notchWidth: notchWidth, minWing: 0, maxWidth: window)
            }
            let closedWidth = closed(0)
            try save(island(width: closedWidth, radius: 12) { EmptyView() }, "01-riposo")
            try save(open(.goals), "05-obiettivi")
            if CommandLine.arguments.contains("--gallery") {
                for (name, event) in notifications() {
                    try save(island(width: NotchSize.note, radius: NotchSpace.noteRadius) {
                        NotchNotificationView(event: event, phase: .arrive, rows: store.rows, requests: store.requests)
                    }, "02-notifica-\(name)-arriva")
                    try save(island(width: NotchSize.note, radius: NotchSpace.noteRadius) {
                        NotchNotificationView(event: event, phase: .settle, rows: store.rows, requests: store.requests)
                    }, "03-notifica-\(name)-cambia")
                    try save(island(width: closedWidth, radius: 12, mark: event) { EmptyView() }, "04-notifica-\(name)-sparisce")
                    if let notice = event.notice(rows: store.rows, requests: store.requests) {
                        let short = event.notice(rows: store.rows, requests: store.requests, withSession: false)
                        try save(island(width: closedWidth, radius: 12, notice: notice, noticeShort: short) { EmptyView() },
                                 "18-avviso-\(name)")
                    }
                }
                let pages = store.rows.pages
                if pages.count > 1 {
                    // A still of the slide: the next page, dimmed as both pages are while it moves.
                    try save(open(.goals) {
                        GoalPage(row: pages[1], position: 2, of: pages.count, now: store.now).opacity(0.35).blur(radius: 2)
                    }, "06-scorrimento")
                } else {
                    print("snapshot: one goal only, no «scorrimento» frame")
                }
                let toConfirm = GoalBoard.tab(store.rows, rejected: store.rejected).toConfirm
                if toConfirm.isEmpty {
                    print("snapshot: no proposed goal, no «da confermare» frame")
                } else {
                    try save(open(.goals) {
                        ProposalsPage(rows: Array(toConfirm.prefix(ProposalsPage.perPage)), total: toConfirm.count)
                    }, "16-da-confermare")
                    try save(open(.goals) {
                        ProposalsPage(rows: Array(toConfirm.prefix(ProposalsPage.perPage)), total: toConfirm.count, openFirst: true)
                    }, "17-da-confermare-testo-intero")
                }
                // #65: Rifiuta and Accetta at rest, under the pointer, pressed (top to bottom).
                try save(open(.goals) {
                    VStack(alignment: .leading, spacing: NotchSpace.row) {
                        ForEach(0..<3) { i in
                            HStack(spacing: 8) {
                                TonePill(label: Text("Rifiuta"), tone: .stop, lit: i == 1, pressed: i == 2)
                                TonePill(label: Text("Accetta"), tone: .go, lit: i == 1, pressed: i == 2)
                            }
                        }
                    }
                }, "19-bottoni-riposo-hover-premuto")
                // #86: a merged PR, the light at a quarter, half and three quarters of its pass, then the line halfway out (#100: the text gone on the left).
                let merged = PRInfo(ref: PRRef(repo: "SQUADD26/clotch", number: 86), title: "Notch: luce sulle PR unite",
                                    url: "https://github.com/SQUADD26/clotch/pull/86", state: .merged)
                try save(open(.goals) {
                    VStack(alignment: .leading, spacing: NotchSpace.row) {
                        ForEach([0.25, 0.5, 0.75] as [CGFloat], id: \.self) { GoalPRRow(info: merged, shine: $0) }
                        GoalPRRow(info: merged).modifier(RowExitModifier(amount: 0.5))
                    }
                }, "20-pr-unita-luce-e-uscita")
                try save(open(.requests), "07-richieste")
                if store.requests.count > RequestsTab.perPage {
                    try save(open(.requests) {
                        RequestsTab(requests: store.requests, active: store.requestsFolderExists, startPage: 1)
                    }, "15-richieste-pagina2")
                } else {
                    print("snapshot: \(store.requests.count) requests, no second page")
                }
                try save(open(.adhd, adhdCount: AdhdRequest.unansweredCount(AdhdRequest.samples)) { AdhdTab(items: AdhdRequest.samples) }, "21-adhd")
                try save(open(.accounts), "08-account")
                // «Larghezza» at its widest (#99): the open notch is as wide as the closed one, never narrower.
                let widest = closed(1)
                try save(island(width: widest, radius: 12) { EmptyView() }, "02-larghezza-massima-chiuso")
                try save(open(.goals, width: NotchWidth.open(notchWidth: notchWidth, standard: openWidth, closed: widest, window: window)),
                         "02-larghezza-massima-aperto")
                let inUse = AccountQuotaFeed.shared.accounts.filter { AccountsInUseFeed.shared.emails.contains($0.email) }.count
                if inUse > 0 {
                    // Room under the island for the card, which hangs outside it as in the panel.
                    try save(island(width: closedWidth, radius: 12, cardOpen: true) { EmptyView() }
                        .padding(.bottom, CGFloat(inUse) * 90 + 60).background(surround)
                        .accountsCard(allowed: true), "11-passaggio-account")
                } else {
                    print("snapshot: no account in use on this Mac, no «passaggio account» frame")
                }
                // The gear at the right of the tab bar: in every open frame, this one is named for it.
                try save(open(.goals), "14-pulsante-impostazioni")
                // The voice light at three moments 1 s apart (#15, #29): the colours move along the edge; the brightness stays
                // in its high band (before the first word, loud, quiet), as `VoiceStatus.intensity` gives it.
                for (t, level) in [(0.0, VoiceStatus.steadyLevel), (1.0, 1), (2.0, 0.35)] as [(TimeInterval, Float)] {
                    try save(island(width: closedWidth, radius: 12,
                                    voice: (VoiceStatus.intensity(level), t / VoiceEdgeLook.period)) { EmptyView() },
                             "17-voce-\(Int(t))s")
                }
                // #110: every state of the voice-in pill with its light on the outline, named like the Figma notes.
                for (name, input) in VoiceInputController.stills {
                    try save(island(width: NotchSize.note, radius: NotchSpace.noteRadius, light: input.light) {
                        VoiceInputPill(input: input)
                    }, "21-pill-\(name)")
                }
                // AFK (#106), with the Figma's examples: the moon off and on, the closed sign, the summary long, short and empty.
                try save(open(.goals, afkOn: false) { GoalsTab(rows: store.rows, now: store.now) }, "22-afk-aperto-spento")
                try save(open(.goals, afkOn: true, afk: 4) { GoalsTab(rows: store.rows, now: store.now) }, "23-afk-aperto-acceso")
                try save(island(width: closedWidth, radius: 12, afk: 4) { EmptyView() }, "24-afk-chiuso-acceso")
                for (name, report) in [("riepilogo", AfkSample.summary), ("lista-lunga", AfkSample.long), ("niente", AfkSample.nothing)] {
                    try save(island(width: openWidth, radius: NotchSpace.radius) {
                        AfkSummaryView(report: report, animated: false, dismiss: {})
                    }, "25-afk-\(name)")
                }
                print("snapshot: the no-notch centre comes with #5")
                try SettingsSnapshot.save(into: dir)
            }
            print("snapshot: \(store.rows.count) goals, \(AccountQuotaFeed.shared.accounts.count) accounts, \(store.requests.count) requests -> \(dir.path)")
        } catch {
            print("snapshot failed: \(error)")
            failed = true
        }
        exit(failed ? 1 : 0)
    }

    /// The notifications today's data can really produce; one that cannot is skipped and said.
    private static func notifications() -> [(String, NotchEvent)] {
        let store = GoalStore.shared
        var out: [(String, NotchEvent)] = []
        if let taken = store.requests.first(where: \.taken) {
            out.append(("richiesta", NotchEvent(kind: .requestTaken, subject: taken.id, count: 0)))
        } else {
            print("snapshot: no request taken in charge yet, no «presa in carico» frames")
        }
        // The goal chased now, as the change its present state would have announced.
        if let hero = store.rows.hero {
            let kind: NotchEvent.Kind?
            switch hero.status {
            case .blocked: kind = .blocked
            case .still: kind = .still
            case .reached: kind = .reached
            case .moving: kind = hero.proofsDone > 0 ? .proofDone : nil
            }
            if let kind {
                out.append(("obiettivo", NotchEvent(kind: kind, subject: hero.id, count: hero.proofsDone)))
            } else {
                print("snapshot: the goal chased now is moving with no proof done, no goal frames")
            }
        }
        return out
    }

    /// The closed island (wings beside the notch) with `below` hanging under it; `mark` stands in for
    /// the notifier's `.leave` step, which the right wing reads from the live notifier.
    private static func island<Below: View>(width: CGFloat, radius: CGFloat, mark: NotchEvent? = nil, notice: String? = nil, noticeShort: String? = nil, cardOpen: Bool = false,
                                            afk: Int? = nil, expanded: Bool = false, voice: (level: Float, phase: Double)? = nil, light: VoiceInputController.Light = .off,
                                            @ViewBuilder below: () -> Below) -> some View {
        VStack(spacing: 0) {
            NotchZonesView(
                // The notice stands where the goal chased now does: the centre of a screen without a notch (#39).
                layout: .standard(hasNotch: notice == nil), hasNotch: notice == nil, notchWidth: notchWidth,
                data: NotchZoneData(rows: GoalStore.shared.rows, accounts: AccountQuotaFeed.shared.accounts,
                                    inUse: AccountsInUseFeed.shared.emails, now: GoalStore.shared.now,
                                    barHeight: notchHeight, mark: mark, notice: notice, noticeShort: noticeShort, accountsCardOpen: cardOpen,
                                    afk: afk, expanded: expanded)
            )
            .frame(maxWidth: .infinity)
            below()
        }
        .frame(width: width)
        .background(UnevenRoundedRectangle(bottomLeadingRadius: radius, bottomTrailingRadius: radius, style: .continuous).fill(.black))
        .overlay {
            if light != .off {
                VoiceInputLightLive(light: light, shape: UnevenRoundedRectangle(bottomLeadingRadius: radius, bottomTrailingRadius: radius, style: .continuous), still: true)
            }
            if let voice {
                VoiceGlow(shape: UnevenRoundedRectangle(bottomLeadingRadius: radius, bottomTrailingRadius: radius, style: .continuous),
                          level: voice.level, phase: voice.phase)
            }
        }
        .padding(.horizontal, 48)
        .padding(.bottom, 40) // room for the voice light's halo
        .background(surround)
    }

    /// The open notch on `tab`, as the panel draws it.
    private static func open(_ tab: NotchTab, width: CGFloat = openWidth) -> some View {
        let store = GoalStore.shared
        return island(width: width, radius: NotchSpace.radius) {
            NotchSectionsContent(store: store, quota: AccountQuotaFeed.shared, now: store.now, tab: .constant(tab))
        }
    }

    /// The open notch's tab bar with `body` as the tab's content (a second page, a still of a slide).
    private static func open<Body: View>(_ tab: NotchTab, afkOn: Bool? = nil, afk: Int? = nil, adhdCount: Int = 0, @ViewBuilder body: () -> Body) -> some View {
        island(width: openWidth, radius: NotchSpace.radius, afk: afk, expanded: true) {
            VStack(spacing: NotchSpace.section) {
                TabBar(tab: .constant(tab), adhdCount: adhdCount, afkOn: afkOn)
                body().frame(maxWidth: .infinity, alignment: .topLeading)
            }
            .padding(.horizontal, NotchSpace.side)
            .padding(.top, 10)
            .padding(.bottom, NotchSpace.bottom)
        }
    }

    private static func write<V: View>(_ view: V, to url: URL) throws {
        let renderer = ImageRenderer(content: view.environment(\.colorScheme, .dark))
        renderer.scale = 2
        guard let image = renderer.cgImage else { throw CocoaError(.fileWriteUnknown) }
        guard let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else {
            throw CocoaError(.fileWriteUnknown)
        }
        try data.write(to: url)
    }
}
