import AVFoundation
import Combine
import XCTest
@testable import Clotch
import ClotchCore

/// Black team's pilot (voice in): the real `VoiceInputController` walks paths P1 (question), P2 (order), P3 (error) with a recorded
/// voice (`say -o`, no sound), and writes a diary with the seconds of each step to `$PILOTA_DIR/voce-diario.txt`. It records, it does
/// not judge: it fails only when it cannot drive the app. Nothing opens on screen, nothing is played, only temporary homes are written.
/// Skipped without PILOTA_DIR.
@MainActor
final class PilotVoicePathsTests: XCTestCase {
    private var dir: URL!
    private var homes: [URL] = []
    private var diaryURL: URL { dir.appendingPathComponent("voce-diario.txt") }

    override func setUp() async throws {
        guard let d = ProcessInfo.processInfo.environment["PILOTA_DIR"] else { throw XCTSkip("PILOTA_DIR not set") }
        dir = URL(fileURLWithPath: d, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    override func tearDown() async throws {
        homes.forEach { try? FileManager.default.removeItem(at: $0) }
        OverseerDelivery.onFallback = nil
    }

    func testPilotVoicePaths() async throws {
        try? FileManager.default.removeItem(at: diaryURL)
        try await p1()
        try await p2(listening: true)
        try await p2(listening: false)
        try await p3("P3a: solo silenzio, 3 s (motore locale)", engine: "locale", key: .real, speech: nil)
        try await p3("P3b: chiave ElevenLabs rifiutata (motore scribe, chiave finta)", engine: "scribe", key: .fake, speech: "Ciao, questa è una prova")
    }

    // MARK: - Paths

    private func p1() async throws {
        let question = "Quali sessioni stanno lavorando adesso?"
        let (c, d, files) = try await rig("locale", .real, say: question)
        let now = Date()
        VoiceAsk.sessions = { [VoiceRoute.sessionLine(title: "Clotch, voce", status: .processing, lastActivity: now),
                               VoiceRoute.sessionLine(title: "Overseer", status: .idle, lastActivity: now.addingTimeInterval(-600)),
                               VoiceRoute.sessionLine(title: "Squadd CRM", status: .waitingQuestion, lastActivity: now.addingTimeInterval(-120))] }
        defer { VoiceAsk.sessions = { [] } }
        var spoken = false
        c.speak = { [self] text in
            d.add("parlatore CHIAMATO con testo: «\(text)»")
            d.add(await fetchSpeech(text, files))
            spoken = true
        }
        guard try await utter(c, d, say: question) else { return try save(d, "P1: domanda «\(question)»") }
        let idle = await until(150) { c.phase == .idle }
        d.add(idle ? "BARRA idle: \(d.since()) s dopo il secondo press" : "BARRA NON idle dopo 150 s, fase \(c.phase)")
        let late = await until(40) { spoken }
        if !spoken { d.add(late ? "" : "parlatore MAI chiamato (o ancora in corso) 40 s dopo la barra") }
        try save(d, "P1: domanda «\(question)» (sessioni finte date a VoiceAsk: 3 righe; `claude -p` vero)")
    }

    private func p2(listening: Bool) async throws {
        let order = "Chiudi le sessioni vecchie di stasera"
        let (c, d, files) = try await rig("locale", .real, say: order)
        var mod: Task<Void, Never>?
        if listening {
            try? FileManager.default.createDirectory(at: files.inboxURL, withIntermediateDirectories: true)
            FileManager.default.createFile(atPath: files.inboxListenerURL.path, contents: Data())
            mod = Task { @MainActor in  // Clean View's mod: reads the order, deletes it after 1 s
                var seen = Set<String>()
                while !Task.isCancelled {
                    let names = (try? FileManager.default.contentsOfDirectory(atPath: files.inboxURL.path)) ?? []
                    for n in names where !n.hasPrefix(".") && seen.insert(n).inserted {
                        let body = (try? String(contentsOf: files.inboxURL.appendingPathComponent(n), encoding: .utf8)) ?? "?"
                        d.add("INBOX file \(n), contenuto: \(body.trimmingCharacters(in: .whitespacesAndNewlines))")
                        try? await Task.sleep(nanoseconds: 1_000_000_000)
                        try? FileManager.default.removeItem(at: files.inboxURL.appendingPathComponent(n))
                        d.add("mod: file cancellato (= ricevuto)")
                    }
                    try? await Task.sleep(nanoseconds: 100_000_000)
                }
            }
        }
        OverseerDelivery.onFallback = { d.add("RIPIEGO (finto, non eseguito): appunti ← «\($0)»") }
        defer { mod?.cancel() }
        guard try await utter(c, d, say: order) else { return try save(d, "P2: ordine") }
        let idle = await until(60) { c.phase == .idle }
        d.add(idle ? "BARRA idle: \(d.since()) s dopo il secondo press" : "BARRA NON idle dopo 60 s, fase \(c.phase)")
        let left = ((try? FileManager.default.contentsOfDirectory(atPath: files.inboxURL.path)) ?? []).filter { !$0.hasPrefix(".") }
        d.add("file rimasti nell'inbox alla fine: \(left.count)")
        try save(d, "P2\(listening ? "" : "-senza-ascolta"): ordine «\(order)»" + (listening ? " (.ascolta fresco, il mod cancella dopo 1 s)" : " (nessun .ascolta)"))
    }

    private func p3(_ title: String, engine: String, key: Key, speech: String?) async throws {
        let (c, d, _) = try await rig(engine, key, say: speech)
        guard try await utter(c, d, say: speech, silence: 3) else { return try save(d, title) }
        let end = await until(60) { c.phase == .idle }
        let failed = d.first("fase failure")
        d.add(end ? "BARRA idle: \(d.since()) s dopo il tempo zero" : "BARRA NON idle dopo 60 s, fase \(c.phase)")
        if let failed, let back = d.first("fase idle", after: failed.0) {
            d.add("ERRORE visibile \(String(format: "%.1f", back.0.timeIntervalSince(failed.0))) s, poi idle da sola")
        } else {
            d.add(failed == nil ? "nessun errore mostrato" : "ERRORE mai tornato idle da solo entro 60 s")
        }
        if failed == nil {  // nothing red: the next press must simply start
            try await pressAfter(c, d, wait: 0)
        } else {  // a second walk to the red bar, then a press 2 s into it
            try save(d, title)
            let (c2, d2, _) = try await rig(engine, key, say: speech)
            _ = try await utter(c2, d2, say: speech, silence: 3)
            if await until(40, { Self.failing(c2.phase) }) { try await pressAfter(c2, d2, wait: 2) }
            else { d2.add("l'errore non è comparso nella seconda corsa") }
            return try save(d2, title + " - seconda corsa: press 2 s dopo che compare l'errore")
        }
        try save(d, title)
    }

    /// A press `wait` s after the bar shows an error (or went idle): does it listen again, within 4 s.
    private func pressAfter(_ c: VoiceInputController, _ d: Diary, wait: TimeInterval) async throws {
        try await Task.sleep(nanoseconds: UInt64(wait * 1e9))
        d.add("PRESS di nuovo (fase attuale: \(c.phase))")
        let t = Date()
        c.press()
        let ok = await until(4) { c.phase == .listening }
        d.add(ok ? "riparte: fase listening dopo \(String(format: "%.1f", Date().timeIntervalSince(t))) s" : "NON riparte in 4 s, fase \(c.phase)")
        try await Task.sleep(nanoseconds: 3_000_000_000)
        c.cancel()
    }

    // MARK: - Rig

    private enum Key { case real, fake }

    /// A controller with a temporary home and a recorded voice; every phase and text change goes to the diary.
    private func rig(_ engine: String, _ key: Key, say text: String?) async throws -> (VoiceInputController, Diary, VoiceFiles) {
        let home = FileManager.default.temporaryDirectory.appendingPathComponent("clotch-pilota-\(UUID().uuidString)")
        homes.append(home)
        let voce = home.appendingPathComponent(".config/voce")
        try FileManager.default.createDirectory(at: voce, withIntermediateDirectories: true)
        let config: [String: Any] = ["ingresso_acceso": true, "ingresso_motore": engine, "ingresso_modo": "premi", "ingresso_lingua": "it", "ingresso_a_voce": true]
        try JSONSerialization.data(withJSONObject: config).write(to: voce.appendingPathComponent("config.json"))
        let keyURL = home.appendingPathComponent(".config/elevenlabs/api-key")
        try FileManager.default.createDirectory(at: keyURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let real = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".config/elevenlabs/api-key")
        if key == .fake { try Data("xxxxxxxxxxxxxxxx".utf8).write(to: keyURL) }  // right shape, refused by the server
        else if FileManager.default.fileExists(atPath: real.path) { try FileManager.default.createSymbolicLink(at: keyURL, withDestinationURL: real) }
        let files = VoiceFiles(home: home)
        let voice = RecordedVoice(try text.map { try VoiceInputCaptureTests.recorded($0) } ?? [])
        let c = VoiceInputController(files: files)
        c.makeCapture = { _ in voice }
        let d = Diary()
        d.bag = [c.$phase.removeDuplicates().sink { d.add("fase \(Self.describe($0))") },
                          c.$sure.combineLatest(c.$maybe).removeDuplicates { $0 == $1 }.dropFirst().sink { d.add("testo barra: sicuro=«\($0.0)» forse=«\($0.1)»") },
                          c.$hint.compactMap { $0 }.sink { d.add("avviso barra: \($0)") }]
        d.voice = voice
        d.speechEnd = VoiceInputCaptureTests.speechEnd(try text.map { try VoiceInputCaptureTests.recorded($0) } ?? [])
        if engine == "locale" {
            let t = Date()
            c.prewarm()
            let loaded = await until(120) { await c.local.isLoaded }
            d.add("modello locale caricato in \(String(format: "%.1f", Date().timeIntervalSince(t))) s (prewarm all'avvio): \(loaded)")
        }
        return (c, d, files)
    }

    /// Press, listen until the voice ends (or `silence` s of silence), second press (time zero of the diary).
    private func utter(_ c: VoiceInputController, _ d: Diary, say: String?, silence: TimeInterval = 0) async throws -> Bool {
        d.add("PRESS 1")
        c.press()
        guard await until(10, { c.phase == .listening }) else { XCTFail("la barra non ascolta: fase \(c.phase)"); return false }
        let voice = d.voice!
        let end = say == nil ? silence : d.speechEnd + 0.3
        _ = await until(60) { voice.playedSeconds >= end || Self.failing(c.phase) }
        d.zero = Date()
        if Self.failing(c.phase) { d.add("l'errore è comparso PRIMA del secondo press (tempo zero = errore), il secondo press non c'è stato"); return true }
        d.add("PRESS 2 (tempo zero), fase \(c.phase)")
        c.press()
        return true
    }

    /// ElevenLabs speech for the answer, saved as mp3 (never played): proof the voice would arrive and how fast.
    private func fetchSpeech(_ text: String, _ files: VoiceFiles) async -> String {
        guard let key = files.key else { return "ElevenLabs: nessuna chiave valida, voce NON arriverebbe" }
        let t = Date()
        let request = VoiceTurn.speechRequest(text: text, config: VoiceTurn.Config((try? files.readConfig()) ?? [:]), key: key, pronunciation: files.pronunciation)
        guard let (data, reply) = try? await URLSession.shared.data(for: request) else { return "ElevenLabs: nessuna risposta (rete)" }
        let code = (reply as? HTTPURLResponse)?.statusCode ?? 0
        let secs = String(format: "%.1f", Date().timeIntervalSince(t))
        guard code == 200, data.count > 500 else { return "ElevenLabs: HTTP \(code), \(data.count) byte in \(secs) s, voce NON arriverebbe" }
        try? data.write(to: dir.appendingPathComponent("voce-risposta.mp3"))
        return "ElevenLabs: HTTP 200, \(data.count) byte in \(secs) s, salvato voce-risposta.mp3 (qui il parlatore comincerebbe a suonare, non suonato)"
    }

    private func save(_ d: Diary, _ title: String) throws {
        let head = "=== \(title) ===\n"
        let text = head + d.render() + "\n\n"
        if let h = try? FileHandle(forWritingTo: diaryURL) { h.seekToEndOfFile(); h.write(Data(text.utf8)); try h.close() }
        else { try text.write(to: diaryURL, atomically: true, encoding: .utf8) }
    }

    private static func failing(_ p: VoiceInputController.Phase) -> Bool { if case .failure = p { return true } else { return false } }

    private static func describe(_ p: VoiceInputController.Phase) -> String {
        switch p {
        case .failure(let why): return "failure: «\(why.title)» / «\(why.detail)» / bottoni: \(why.actions.map(\.label).joined(separator: " | "))"
        case .result(let m): return "result: «\(m)»"
        default: return "\(p)"
        }
    }

    private func until(_ seconds: TimeInterval, _ condition: () async -> Bool) async -> Bool {
        let deadline = Date().addingTimeInterval(seconds)
        while !(await condition()) {
            guard Date() < deadline else { return false }
            try? await Task.sleep(nanoseconds: 20_000_000)
        }
        return true
    }
}

/// The diary of one path: events with their time, shown in seconds from the second press (negative before it).
@MainActor
private final class Diary {
    var events: [(Date, String)] = []
    var zero: Date?
    var voice: RecordedVoice?
    var speechEnd = 0.0
    var bag: [AnyCancellable] = []

    func add(_ text: String) { if !text.isEmpty { events.append((Date(), text)) } }
    func since() -> String { String(format: "%.1f", Date().timeIntervalSince(zero ?? events.first?.0 ?? Date())) }
    func first(_ prefix: String, after: Date = .distantPast) -> (Date, String)? { events.first { $0.0 > after && $0.1.hasPrefix(prefix) } }

    func render() -> String {
        let base = zero ?? events.first?.0 ?? Date()
        return events.map { String(format: "%+6.1f s  ", $0.0.timeIntervalSince(base)) + $0.1 }.joined(separator: "\n")
    }
}
