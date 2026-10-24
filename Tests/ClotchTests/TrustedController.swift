import Foundation
@testable import Clotch
import ClotchCore

extension VoiceInputController {
    /// A controller whose voice check says «it is him», on an unlocked Mac, with a print in a temp folder: the tests that are not about
    /// the voice check (#1120) go through it, so they never touch Roberto's real print or listen to the real lock screen.
    @MainActor static func trusting(files: VoiceFiles) -> VoiceInputController {
        let c = VoiceInputController(files: files)
        let store = VoiceTrust.Store(url: FileManager.default.temporaryDirectory.appendingPathComponent("clotch-print-\(UUID().uuidString).json"))
        try? store.save([[1, 0], [1, 0.1], [1, 0.2]])
        c.trustStore = store
        c.verify = { _ in (.yes, 0.1) }
        c.unlocked = { true }
        c.fromKey = true  // the tests call `route` without the press
        c.soundPlayer = { _ in }
        return c
    }
}
