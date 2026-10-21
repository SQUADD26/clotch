import Foundation
import Combine
import CoreServices
import CodeIslandCore

/// Publishes the Overseer's voice state (contract in `CodeIslandCore/NotchVoice.swift`): `status` is non-nil from the moment
/// the player writes ~/.config/voce/stato.json until `t_fine` or until it writes `parla:false`. No polling: one FSEventStream
/// with file events (no coalescing delay beyond 50 ms, so the light starts at once) and one one-shot timer for `t_fine`.
/// Read-only: it never creates a directory. It watches ~/.config (not ~/.config/voce) so the file shows up even if the folder
/// is created after launch; other writers there wake it, and the filter drops them before any read.
@MainActor
final class VoiceStore: ObservableObject {
    static let shared = VoiceStore()
    @Published private(set) var status: VoiceStatus?

    private let file: URL
    private var stream: FSEventStreamRef?
    private var expiry: DispatchWorkItem?

    init(home: URL = FileManager.default.homeDirectoryForCurrentUser) {
        file = home.appendingPathComponent(".config/voce/stato.json")
    }

    func start() {
        guard stream == nil else { return }
        reload()
        let root = file.deletingLastPathComponent().deletingLastPathComponent()
        var context = FSEventStreamContext(version: 0, info: Unmanaged.passUnretained(self).toOpaque(),
                                           retain: nil, release: nil, copyDescription: nil)
        let callback: FSEventStreamCallback = { _, info, count, eventPaths, _, _ in
            guard let info else { return }
            let list = (unsafeBitCast(eventPaths, to: NSArray.self) as? [String]) ?? []
            guard list.prefix(count).contains(where: { $0.hasSuffix("/voce/stato.json") }) else { return }
            let store = Unmanaged<VoiceStore>.fromOpaque(info).takeUnretainedValue()
            MainActor.assumeIsolated { store.reload() } // the stream runs on the main queue
        }
        guard let s = FSEventStreamCreate(nil, callback, &context, [root.path, root.resolvingSymlinksInPath().path] as CFArray,
                                          FSEventStreamEventId(kFSEventStreamEventIdSinceNow), 0.05,
                                          FSEventStreamCreateFlags(kFSEventStreamCreateFlagUseCFTypes | kFSEventStreamCreateFlagFileEvents | kFSEventStreamCreateFlagNoDefer)) else { return }
        FSEventStreamSetDispatchQueue(s, .main)
        FSEventStreamStart(s)
        stream = s
    }

    func stop() {
        guard let s = stream else { return }
        FSEventStreamStop(s)
        FSEventStreamInvalidate(s)
        FSEventStreamRelease(s)
        stream = nil
        expiry?.cancel()
    }

    private func reload() {
        expiry?.cancel()
        let next = (try? Data(contentsOf: file)).flatMap(VoiceStatus.parse)
        guard let next, next.isSpeaking(at: Date()) else { status = nil; return }
        if next != status { status = next }
        let item = DispatchWorkItem { [weak self] in MainActor.assumeIsolated { self?.status = nil } }
        expiry = item
        DispatchQueue.main.asyncAfter(deadline: .now() + max(0, next.end.timeIntervalSinceNow), execute: item)
    }
}
