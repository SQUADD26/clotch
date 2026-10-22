import XCTest
import ClotchCore
@testable import Clotch

/// La logica della scheda ADHD (#158, claude-config#1967): una lettura fallita non è «Nessuna domanda», e «Rimuovi» lancia
/// `richieste.py letta` solo dopo la pausa, mai se si annulla prima. Il comando è finto: niente parte sul serio.
@MainActor
final class AdhdStoreTests: XCTestCase {
    /// The fake command: what it answers and which arguments it was given.
    private final class Script: @unchecked Sendable {
        private let lock = NSLock()
        private var answer: Result<Data, AdhdFailure> = .success(Data("[]".utf8))
        private var calls: [[String]] = []
        func set(_ value: Result<Data, AdhdFailure>) { lock.withLock { answer = value } }
        func run(_ args: [String]) -> Result<Data, AdhdFailure> { lock.withLock { calls.append(args); return answer } }
        var letta: [[String]] { lock.withLock { calls.filter { $0.contains("letta") } } }
    }

    private func store(_ script: Script, grace: TimeInterval = 0.3) -> AdhdStore {
        let store = AdhdStore(grace: grace, run: { script.run($0) })
        store.items = AdhdRequest.samples
        return store
    }

    func testFailedReadIsNotAnEmptyList() async {
        let script = Script(), store = AdhdStore(run: { script.run($0) })
        script.set(.failure(.exit(2, stderr: "traccia\nrichieste.py: file non trovato\n")))
        store.refresh()
        await waitUntil { store.failure != nil }
        XCTAssertEqual(store.failure?.message, "Il comando delle richieste è uscito con errore 2: «richieste.py: file non trovato». Riprova tra poco.")
        XCTAssertTrue(store.items.isEmpty, "the list is empty but the tab must show the error, not «Nessuna domanda»")

        script.set(.success(Data("non è json".utf8)))
        store.refresh()
        await waitUntil { store.failure == .unreadable }

        script.set(.success(Data(#"[{"id":"Q-1","domanda_chiara":"Come?"}]"#.utf8)))
        store.refresh()
        await waitUntil { store.failure == nil && store.items.count == 1 }
    }

    func testUndoWithinTheGraceRunsNoCommand() async throws {
        let script = Script(), store = store(script)
        store.markRead("Q-3")
        XCTAssertEqual(store.items.count, 4)
        XCTAssertEqual(store.removal?.rows.map(\.id), ["Q-3"])
        store.undoRemoval()
        XCTAssertEqual(store.items.map(\.id), AdhdRequest.samples.map(\.id))
        XCTAssertNil(store.removal)
        try await Task.sleep(for: .seconds(0.8))  // well past the grace
        XCTAssertTrue(script.letta.isEmpty, "undone: «letta» must never run")
    }

    func testCommandRunsOnlyWhenTheGraceEnds() async throws {
        let script = Script(), store = store(script)
        store.markRead("Q-3")
        XCTAssertTrue(script.letta.isEmpty, "not at the click")
        await waitUntil { !script.letta.isEmpty }
        XCTAssertEqual(script.letta.map { Array($0.suffix(2)) }, [["letta", "Q-3"]])
        XCTAssertNil(store.removal)
    }

    func testFocusIsSetByShowAndClearedWhenTheNotchCloses() {
        let store = AdhdStore()
        store.show(question: "Come?")
        XCTAssertEqual(store.focus, "Come?")
        store.stop()
        XCTAssertNil(store.focus)
    }
}
