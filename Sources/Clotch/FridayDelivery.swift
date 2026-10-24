import Foundation
import ClotchCore

/// What Roberto says goes to the engine through its one door (clotch#1110, claude-config#2771): the `parla` command; Friday decides, answers or passes it on.
/// With Friday off the notch starts her (`friday avvia`); the command waits in the casella and goes at her start (within 1 hour).
@MainActor
enum FridayDelivery {
    enum Outcome: Equatable { case answered(String), passed, refused(String), notReached }

    static func send(_ text: String, door: FridayDoor = FridayDoor(), receiptWait: TimeInterval = 20, answerWait: TimeInterval = 120) async -> Outcome {
        guard let id = try? door.send("parla", args: ["testo": text]) else { return .notReached }
        Task.detached { startIfOff(door.home) }
        var receipt: FridayDoor.Receipt?
        let receiptBy = Date().addingTimeInterval(receiptWait)
        while receipt == nil, Date() < receiptBy {
            try? await Task.sleep(nanoseconds: 250_000_000)
            receipt = door.receipt(of: id)
        }
        switch receipt {
        case nil: return .notReached
        case .refused(let why): return .refused(why)
        case .ok: break
        }
        let answerBy = Date().addingTimeInterval(answerWait)
        while Date() < answerBy {
            if let a = door.answer(to: id) { return a.spokenByClotch ? .answered(a.text) : .passed }
            try? await Task.sleep(nanoseconds: 500_000_000)
        }
        return .passed
    }

    /// `friday stato` exits 1 when she is off: then `friday avvia` (the engine runs by itself under launchd, the notch only wakes it).
    nonisolated static func startIfOff(_ home: URL) {
        let bin = home.appendingPathComponent(".claude/bin/friday").path
        func run(_ arg: String) -> Int32 {
            let p = Process()
            p.executableURL = URL(fileURLWithPath: bin); p.arguments = [arg]
            p.standardOutput = FileHandle.nullDevice; p.standardError = FileHandle.nullDevice
            guard (try? p.run()) != nil else { return -1 }
            p.waitUntilExit()
            return p.terminationStatus
        }
        if FileManager.default.isExecutableFile(atPath: bin), run("stato") == 1 { _ = run("avvia") }
    }
}
