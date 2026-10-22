import XCTest
@testable import ClotchCore

/// #50: the end of a turn → Haiku → ElevenLabs, the key only in a header; the hook installed once and removed whole.
final class VoiceTurnTests: XCTestCase {
    private func json(_ o: [String: Any]) -> Data { try! JSONSerialization.data(withJSONObject: o) }

    func testStopGivesTheAnswerFromPayloadOrTranscript() {
        let now = Date()
        let direct = VoiceEvents.stop(payload: json(["session_id": "s1", "last_assistant_message": "Fatto."]), transcriptTail: { _ in nil }, now: now)
        XCTAssertEqual(direct?.session, "s1")
        XCTAssertEqual(direct?.answer, "Fatto.")
        XCTAssertNil(direct?.question, "no question: the end of turn says nothing")

        let tail = """
            {"type":"assistant","message":{"content":[{"type":"text","text":"Prima"}]}}
            {"type":"user","message":{"content":"ok"}}
            {"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash"},{"type":"text","text":"Ultima risposta"}]}}
            {"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read"}]}}
            """
        var asked = ""
        let fromFile = VoiceEvents.stop(payload: json(["session_id": "s2", "transcript_path": "/t.jsonl"]), transcriptTail: { asked = $0; return Data(tail.utf8) }, now: now)
        XCTAssertEqual(asked, "/t.jsonl")
        XCTAssertEqual(fromFile?.answer, "Ultima risposta")

        XCTAssertNil(VoiceEvents.stop(payload: json(["session_id": "s3", "last_assistant_message": "x", "stop_hook_active": true]), transcriptTail: { _ in nil }, now: now),
                     "Stop fired again by a blocking stop hook: said once")
    }

    func testRefusalsMuteAndCapsMeanNoCalls() {
        let cfg = VoiceTurn.Config(["tetto_chiamate": 2, "tetto_caratteri": 100])
        var day = VoiceTurn.Day(giorno: "x")
        XCTAssertNil(VoiceTurn.refusal(isOn: true, hasKey: true, muted: false, day: day, config: cfg))
        XCTAssertEqual(VoiceTurn.refusal(isOn: false, hasKey: true, muted: false, day: day, config: cfg), "spenta")
        XCTAssertEqual(VoiceTurn.refusal(isOn: true, hasKey: false, muted: false, day: day, config: cfg), "senza chiave")
        XCTAssertEqual(VoiceTurn.refusal(isOn: true, hasKey: true, muted: true, day: day, config: cfg), "sessione muta")
        day.chiamate = 2
        XCTAssertEqual(VoiceTurn.refusal(isOn: true, hasKey: true, muted: false, day: day, config: cfg), "tetto di chiamate del giorno")
        day.chiamate = 0; day.caratteri = 100
        XCTAssertEqual(VoiceTurn.refusal(isOn: true, hasKey: true, muted: false, day: day, config: cfg), "tetto di caratteri del giorno")
    }

    func testDayResetsEachDay() {
        let now = Date()
        let today = VoiceTurn.Day(giorno: VoiceTurn.Day.key(now), chiamate: 3, caratteri: 50)
        XCTAssertEqual(VoiceTurn.Day.load(try? JSONEncoder().encode(today), now: now), today)
        XCTAssertEqual(VoiceTurn.Day.load(Data(#"{"giorno":"2000-1-1","chiamate":9,"caratteri":9}"#.utf8), now: now).chiamate, 0)
    }

    func testHaikuGetsTheReportOnStdinOnly() {
        let args = VoiceTurn.haikuArguments(prompt: "Istruzioni", config: VoiceTurn.Config([:]))
        XCTAssertEqual(args.suffix(2), ["--system-prompt", "Istruzioni"])
        XCTAssertTrue(args.contains("--safe-mode"), "no hooks in Haiku's own run: it cannot trigger the voice again")
        XCTAssertFalse(args.joined().contains("Rapporto segreto"))
        let input = VoiceTurn.haikuInput(report: "Rapporto segreto", previousTopic: "la voce")
        XCTAssertEqual(input, "<rapporto>\nRapporto segreto\n</rapporto>\n<dire_argomento>no</dire_argomento>\n<argomento_precedente>la voce</argomento_precedente>\n")
    }

    func testRewriterRunsWithTheChosenModelAndEffort() {
        func pair(_ c: [String: Any]) -> [String] {
            let a = VoiceTurn.haikuArguments(prompt: "x", config: VoiceTurn.Config(c))
            return [a[a.firstIndex(of: "--model")! + 1], a[a.firstIndex(of: "--effort")! + 1]]
        }
        XCTAssertEqual(pair([:]), ["claude-haiku-5-5", "low"])
        XCTAssertEqual(pair(["riscrittore_modello": "claude-opus-5-5", "riscrittore_ragionamento": "high"]), ["claude-opus-5-5", "high"])
        XCTAssertEqual(pair(["riscrittore_modello": "gpt", "riscrittore_ragionamento": "--tools"]), ["claude-haiku-5-5", "low"])
    }

    func testHaikuAnswerKeepsTopicApartAndRefusesSecrets() {
        let ok = VoiceTurn.spoken(fromHaiku: "La correzione è in produzione.\nARGOMENTO: la voce del notch\n")
        XCTAssertEqual(ok?.text, "La correzione è in produzione.")
        XCTAssertEqual(ok?.topic, "la voce del notch")
        XCTAssertNil(VoiceTurn.spoken(fromHaiku: "La chiave è sk_0123456789abcdef0123456789abcdef"))
        XCTAssertNil(VoiceTurn.spoken(fromHaiku: "ARGOMENTO: niente\n"))
        let long = String(repeating: "Una frase breve. ", count: 40)
        XCTAssertLessThanOrEqual(VoiceTurn.spoken(fromHaiku: long)!.text.count, VoiceTurn.maxSpoken)
    }

    func testReportCleanedForTheEarBeforeAndAfterHaiku() throws {
        let raw = "Fatto: PR #55 su `feat/50-voce` (commit c254d67a), vedi https://github.com/x/y e Sources/Clotch/VoiceSpeaker.swift.\n- Prossimo passo (sì)"
        let report = { (text: String) in VoiceEvent(kind: .question, at: Date(), text: text).report }
        let r = report(raw)
        for bad in ["55", "c254d67a", "https", "github", "Sources/", "VoiceSpeaker", "`", "feat/"] {
            XCTAssertFalse(r.contains(bad), "\(bad) in «\(r)»")
        }
        XCTAssertTrue(r.contains("la modifica"))
        XCTAssertFalse(r.contains("consiglio"), "never «io consiglio di sì» (#84): «\(r)»")
        let long = String(repeating: "Una frase del rapporto. ", count: 50)
        XCTAssertLessThanOrEqual(report(long).count, VoiceTurn.maxSpoken)
        XCTAssertFalse(report("la chiave è sk_0123456789abcdefabcd").contains("sk_"), "a key never reaches Haiku")
        XCTAssertNil(VoiceTurn.spoken(fromHaiku: "Apri il terminale e incolla il comando.\nARGOMENTO: la voce"), "only an order: a failed try, no fixed line")
        XCTAssertEqual(VoiceTurn.spoken(fromHaiku: "Mi serve il tuo sì. Apri il terminale e incolla il comando.")?.text, "Mi serve il tuo sì.")
        XCTAssertEqual(VoiceTurn.spoken(fromHaiku: "La modifica #12 è pronta, capo.")?.text, "La modifica è pronta, capo.")
    }

    func testElevenLabsRequestKeyOnlyInHeader() throws {
        let cfg = VoiceTurn.Config(["voice_id": "voce123456", "speed": 1.8, "model_id": "eleven_v4_turbo"])
        let key = "sk_chiave_di_prova_123"
        let r = VoiceTurn.speechRequest(text: "Ciao", config: cfg, key: key, pronunciation: [:])
        XCTAssertEqual(r.value(forHTTPHeaderField: "xi-api-key"), key)
        XCTAssertFalse(r.url!.absoluteString.contains(key))
        XCTAssertTrue(r.url!.absoluteString.contains("/text-to-speech/voce123456"))
        let body = try XCTUnwrap(r.httpBody)
        XCTAssertFalse(String(decoding: body, as: UTF8.self).contains(key))
        let o = try JSONSerialization.jsonObject(with: body) as! [String: Any]
        XCTAssertEqual(o["text"] as? String, "Ciao")
        XCTAssertEqual(o["language_code"] as? String, "it", "Italian forced, no foreign accent")
        let multi = VoiceTurn.speechRequest(text: "Ciao", config: VoiceTurn.Config(["model_id": "eleven_multilingual_v2"]), key: key, pronunciation: [:])
        XCTAssertNil((try JSONSerialization.jsonObject(with: XCTUnwrap(multi.httpBody)) as! [String: Any])["language_code"], "that model rejects the field")
        XCTAssertEqual((o["voice_settings"] as? [String: Any])?["speed"] as? Double, 1.2, "ElevenLabs caps at 1.2")
        XCTAssertEqual(VoiceTurn.playbackRate(cfg), 1.5, accuracy: 0.001, "the player does the rest")
        XCTAssertEqual(VoiceTurn.Config([:]).voiceId, VoiceTurn.Config.defaultVoice, "only the key set: a premade voice")
    }

    func testHookInstalledOnceRemovedWhole() throws {
        let other: [String: Any] = ["matcher": "", "hooks": [["type": "command", "command": "~/altro.sh"]]]
        let start: [String: Any] = ["Stop": [other], "PreToolUse": [other]]
        let installed = try XCTUnwrap(VoiceHooks.adding(to: start))
        XCTAssertEqual((installed["Stop"] as? [Any])?.count, 2)
        XCTAssertNil(VoiceHooks.adding(to: installed), "installed once")
        let removed = try XCTUnwrap(VoiceHooks.removing(from: installed))
        XCTAssertEqual((removed["Stop"] as? [Any])?.count, 1, "the other Stop hook stays")
        XCTAssertNotNil(removed["PreToolUse"])
        XCTAssertNil(VoiceHooks.removing(from: removed))
        let alone = try XCTUnwrap(VoiceHooks.removing(from: try XCTUnwrap(VoiceHooks.adding(to: [:]))))
        XCTAssertNil(alone["Stop"], "no empty Stop list left behind")
    }

    func testEveryClaudeConfigFolderOnce() throws {
        let fm = FileManager.default
        let home = fm.temporaryDirectory.appendingPathComponent("dirs-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: home) }
        for d in [".claude/projects", ".claude-lavoro", ".claude-vuota", ".claude-backup/x"] {
            try fm.createDirectory(at: home.appendingPathComponent(d), withIntermediateDirectories: true)
        }
        try "{}".write(to: home.appendingPathComponent(".claude-lavoro/settings.json"), atomically: true, encoding: .utf8)
        try "{}".write(to: home.appendingPathComponent(".claude.json"), atomically: true, encoding: .utf8)
        try fm.createSymbolicLink(at: home.appendingPathComponent(".claude-link"), withDestinationURL: home.appendingPathComponent(".claude-lavoro"))
        XCTAssertEqual(VoiceHooks.configDirs(home: home).map(\.lastPathComponent), [".claude", ".claude-lavoro"])
    }

    func testHookScriptQueuesOnlyForALiveClotch() throws {
        let home = FileManager.default.temporaryDirectory.appendingPathComponent("hook-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: home) }
        let script = home.appendingPathComponent("voce-stop.sh")
        try FileManager.default.createDirectory(at: home.appendingPathComponent(".config/voce"), withIntermediateDirectories: true)
        try VoiceHooks.script.write(to: script, atomically: true, encoding: .utf8)
        func run(_ env: [String: String] = [:]) throws {
            let p = Process()
            p.executableURL = URL(fileURLWithPath: "/bin/bash")
            p.arguments = [script.path]
            p.environment = ["HOME": home.path, "PATH": "/usr/bin:/bin"].merging(env) { $1 }
            let input = Pipe()
            p.standardInput = input
            try p.run()
            input.fileHandleForWriting.write(Data(#"{"session_id":"s"}"#.utf8))
            input.fileHandleForWriting.closeFile()
            p.waitUntilExit()
            XCTAssertEqual(p.terminationStatus, 0)
        }
        let queue = home.appendingPathComponent(".config/voce/coda")
        let queued = { ((try? FileManager.default.contentsOfDirectory(atPath: queue.path)) ?? []).filter { $0.hasSuffix(".json") } }
        let sign = home.appendingPathComponent(".config/voce/clotch")
        try run()
        XCTAssertEqual(queued(), [], "no live sign: nothing")
        try Data().write(to: sign)
        try FileManager.default.setAttributes([.modificationDate: Date().addingTimeInterval(-3 * 3600)], ofItemAtPath: sign.path)
        try run()
        XCTAssertEqual(queued(), [], "a sign not touched for hours (Clotch died): nothing")
        try Data().write(to: sign)
        try run(["CLOTCH_VOCE_INTERNA": "1"])
        XCTAssertEqual(queued(), [], "Clotch's own Haiku: nothing")
        try run()
        XCTAssertEqual(queued().count, 1)
        let payload = try Data(contentsOf: queue.appendingPathComponent(queued()[0]))
        XCTAssertEqual(String(decoding: payload, as: UTF8.self), #"{"session_id":"s"}"#)
    }

    func testAudienceDefaultsToMainSessionsAndFindsPriorCliIds() {
        let main = DesktopSession(localId: "local_m", cliId: "c-m", parentLocalId: nil, priorCliIds: ["old-m"], title: "M",
                                  isRunning: true, isArchived: false, lastActivity: nil)
        let child = DesktopSession(localId: "local_k", cliId: "c-k", parentLocalId: "local_m", title: "K",
                                   isRunning: true, isArchived: false, lastActivity: nil)
        let all = [main, child]
        let byDefault = VoiceTurn.Config([:])
        XCTAssertEqual(byDefault.audience, .main, "Roberto has not chosen yet: main sessions only")
        XCTAssertTrue(byDefault.speaks(cliId: "c-m", sessions: all))
        XCTAssertTrue(byDefault.speaks(cliId: "old-m", sessions: all), "after a /clear the old cli id is the same session")
        XCTAssertFalse(byDefault.speaks(cliId: "c-k", sessions: all), "a child session stays silent")
        XCTAssertTrue(byDefault.speaks(cliId: "terminal", sessions: all), "no session file: a terminal claude, counted as main")
        XCTAssertTrue(VoiceTurn.Config(["parla_per": "tutte"]).speaks(cliId: "c-k", sessions: all))
        let one = VoiceTurn.Config(["parla_per": "una", "sessione": "local_k"])
        XCTAssertTrue(one.speaks(cliId: "c-k", sessions: all))
        XCTAssertFalse(one.speaks(cliId: "c-m", sessions: all))
        XCTAssertFalse(one.speaks(cliId: "terminal", sessions: all))
        XCTAssertEqual(VoiceTurn.Config(["parla_per": "boh"]).audience, .main)
    }

    // MARK: #73: never «guarda lo schermo», never a fixed line

    let sample = "Ho finito la voce del notch, vedi PR #73 e Sources/Clotch/VoiceSpeaker.swift (c254d67a). La luce ora segue la voce. I test sono verdi. Resta la prova sul Mac. https://github.com/x"

    func testSlowHaikuGetsASecondTry() async {
        let calls = Counter()
        let said = await VoiceTurn.line(timeout: 0.2) {
            if await calls.next() == 1 { try? await Task.sleep(nanoseconds: 3_000_000_000); return "Troppo tardi." }
            return "Capo, la voce del notch è pronta.\nARGOMENTO: la voce del notch"
        }
        XCTAssertEqual(said?.text, "Capo, la voce del notch è pronta.")
        XCTAssertEqual(said?.topic, "la voce del notch")
        let n = await calls.count
        XCTAssertEqual(n, 2)
    }

    func testTwoFailuresAreSilence() async {
        let calls = Counter()
        let line = await VoiceTurn.line(timeout: 0.2) { _ = await calls.next(); return nil }
        let n = await calls.count
        XCTAssertEqual(n, 2, "two tries")
        XCTAssertNil(line, "the rewriter failed: silence, never the report (#84)")
    }

    func testAdviceFormulaNeverSaid() {
        XCTAssertEqual(VoiceTurn.spoken(fromHaiku: "Mi serve il tuo sì per la luce del notch. Io dico sì.")?.text, "Mi serve il tuo sì per la luce del notch.")
        XCTAssertEqual(VoiceTurn.spoken(fromHaiku: "Devi scegliere il colore, capo. Io consiglio di no.")?.text, "Devi scegliere il colore, capo.")
        XCTAssertNil(VoiceTurn.spoken(fromHaiku: "Io direi di sì."))
    }

    func testPronunciationAppliedBeforeElevenLabs() throws {
        let words = ["Clotch": "Clocc", "notch": "nocc", "PR": "pi àr", "CI": "si ai", "pi": "PI"]
        let r = VoiceTurn.speechRequest(text: "Clotch sul notch, la PR e il NOTCH. Clotchino resta, la CI ci vede, la pr no.",
                                        config: VoiceTurn.Config([:]), key: "k", pronunciation: words)
        let o = try JSONSerialization.jsonObject(with: XCTUnwrap(r.httpBody)) as! [String: Any]
        XCTAssertEqual(o["text"] as? String, "Clocc sul nocc, la pi àr e il nocc. Clotchino resta, la si ai ci vede, la pr no.",
                       "a sigla matches capitals only; one pass: «pi» of «pi àr» is not read again")
        XCTAssertEqual(VoiceTurn.pronounced("niente", [:]), "niente")
        XCTAssertEqual(VoiceTurn.pronounced("costa 5$", ["5$": "cinque dollari $1"]), "costa cinque dollari $1")
    }

    func testNoCopyOfTheVoicePromptInClotch() throws {
        // #84: the prompt and the judge question are the config's files; a line of them inside Clotch's sources is a copy.
        let sources = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("../../Sources").standardized
        let all = FileManager.default.enumerator(at: sources, includingPropertiesForKeys: nil)!.compactMap { $0 as? URL }.filter { $0.pathExtension == "swift" }
        XCTAssertFalse(all.isEmpty)
        for f in all {
            let src = try String(contentsOf: f, encoding: .utf8)
            for line in ["Sei la voce di Roberto", "Come rispondi: prima riga la frase da dire", "E' necessario avvisare l'utente adesso"] {
                XCTAssertNil(src.range(of: line), f.lastPathComponent)
            }
        }
    }

    func testNoFixedSentenceAnywhere() throws {
        for f in ["VoiceTurn.swift", "VoiceClean.swift"] {
            let src = try String(contentsOf: URL(fileURLWithPath: #filePath).deletingLastPathComponent()
                .appendingPathComponent("../../Sources/ClotchCore/\(f)").standardized, encoding: .utf8)
            XCTAssertNil(src.range(of: "guarda lo schermo", options: .caseInsensitive), f)
            XCTAssertNil(src.range(of: "c’è una novità", options: .caseInsensitive), f)
        }
    }

    /// #271: a voice that was cut short logged its nominal length as if it had played all of it.
    func testSaidLogTellsWhatReallyPlayed() {
        XCTAssertEqual(VoiceTurn.saidLog(chars: 80, length: 6.0, played: 1.4), "voice said: 80 chars, 1.4 s played of 6.0 s, interrotta")
        XCTAssertEqual(VoiceTurn.saidLog(chars: 80, length: 6.0, played: 6.05), "voice said: 80 chars, 6.0 s of audio")
    }
}

actor Counter {
    var count = 0
    func next() -> Int { count += 1; return count }
}
