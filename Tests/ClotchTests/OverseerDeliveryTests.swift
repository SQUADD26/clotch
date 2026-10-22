import XCTest
@testable import Clotch
import ClotchCore

/// #200: with a fresh `.ascolta` Clotch never takes the order back from the inbox; the clipboard fallback is only for no reader.
/// Temporary home, short grace, fallback recorded: no clipboard, no app opened.
@MainActor
final class OverseerDeliveryTests: XCTestCase {
    private var home: URL!
    private var files: VoiceFiles!
    private var fallbacks: [String] = []

    override func setUp() {
        home = FileManager.default.temporaryDirectory.appendingPathComponent("clotch-consegna-\(UUID().uuidString)")
        files = VoiceFiles(home: home)
        fallbacks = []
        OverseerDelivery.onFallback = { [unowned self] in fallbacks.append($0) }
    }

    override func tearDown() {
        OverseerDelivery.onFallback = nil
        try? FileManager.default.removeItem(at: home)
    }

    private func listen() throws {
        try FileManager.default.createDirectory(at: files.inboxURL, withIntermediateDirectories: true)
        FileManager.default.createFile(atPath: files.inboxListenerURL.path, contents: Data())
    }

    private func inbox() -> [String] { ((try? FileManager.default.contentsOfDirectory(atPath: files.inboxURL.path)) ?? []).filter { !$0.hasPrefix(".") } }

    func testBusyReaderLeavesTheOrderInTheInbox() async throws {
        try listen()
        let outcome = await OverseerDelivery.send("chiudi le sessioni", files: files, grace: 0.3)
        XCTAssertEqual(outcome, .queued)
        XCTAssertEqual(inbox().count, 1, "the file stays for the reader")
        XCTAssertTrue(fallbacks.isEmpty)
    }

    func testReaderTakingTheOrderWithinTheGraceIsSent() async throws {
        try listen()
        let mod = Task { @MainActor in
            while !Task.isCancelled {
                for n in self.inbox() { try? FileManager.default.removeItem(at: self.files.inboxURL.appendingPathComponent(n)) }
                try? await Task.sleep(nanoseconds: 50_000_000)
            }
        }
        defer { mod.cancel() }
        let outcome = await OverseerDelivery.send("chiudi le sessioni", files: files, grace: 5)
        XCTAssertEqual(outcome, .sent)
        XCTAssertTrue(fallbacks.isEmpty)
    }

    func testNoReaderFallsBack() async {
        let outcome = await OverseerDelivery.send("chiudi le sessioni", files: files, grace: 0.3)
        XCTAssertEqual(outcome, .copied)
        XCTAssertEqual(fallbacks, ["chiudi le sessioni"])
        XCTAssertTrue(inbox().isEmpty)
    }
}
