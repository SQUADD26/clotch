import Foundation
import ClotchCore

/// What the notch says about the screen (clotch#292): `ScreenNotice.phase` of the tail of eventi.jsonl. `VoiceStore`'s file stream
/// calls `changed()` when the file moves; a one-shot timer ends the countdown and the «Schermo libero» hold. Read-only.
@MainActor
final class ScreenNoticeStore: ObservableObject {
    static let shared = ScreenNoticeStore()
    @Published private(set) var phase: ScreenNotice.Phase?

    private typealias T = FigmaToken.MacOS27GoldenGate
    private let file: URL
    private var expiry: DispatchWorkItem?

    init(home: URL = FileManager.default.homeDirectoryForCurrentUser) {
        file = home.appendingPathComponent(".config/voce/eventi.jsonl")
    }

    func changed() {
        expiry?.cancel()
        let next = Self.tail(of: file).flatMap { ScreenNotice.phase(in: $0, now: Date(), freeHold: T.attesaSchermoLibero) }
        if next != phase { phase = next }
        let end: Date?
        switch next {
        case .incoming(let deadline, _)?: end = deadline
        case .free(let until)?: end = until
        case nil: end = nil
        }
        guard let end else { return }
        let item = DispatchWorkItem { [weak self] in MainActor.assumeIsolated { self?.changed() } }
        expiry = item
        DispatchQueue.main.asyncAfter(deadline: .now() + max(0.01, end.timeIntervalSinceNow), execute: item)
    }

    /// The last 64 KB: the notice only needs the newest lines (the first one may be cut: it does not parse and is skipped).
    private static func tail(of url: URL) -> Data? {
        guard let handle = try? FileHandle(forReadingFrom: url) else { return nil }
        defer { try? handle.close() }
        let size = (try? handle.seekToEnd()) ?? 0
        try? handle.seek(toOffset: size > 65_536 ? size - 65_536 : 0)
        return try? handle.readToEnd()
    }
}
