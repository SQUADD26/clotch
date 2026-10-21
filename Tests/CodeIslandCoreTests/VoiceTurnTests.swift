import XCTest
@testable import CodeIslandCore

/// #50: the end of a turn → Haiku → ElevenLabs, the key only in a header; the hook installed once and removed whole.
final class VoiceTurnTests: XCTestCase {
    private func json(_ o: [String: Any]) -> Data { try! JSONSerialization.data(withJSONObject: o) }

    func testReportFromPayloadOrTranscript() {
        let direct = VoiceTurn.report(payload: json(["session_id": "s1", "last_assistant_message": " Fatto. "])) { _ in nil }
        XCTAssertEqual(direct?.session, "s1")
        XCTAssertEqual(direct?.text, "Fatto.")

        let tail = """
            {"type":"assistant","message":{"content":[{"type":"text","text":"Prima"}]}}
            {"type":"user","message":{"content":"ok"}}
            {"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash"},{"type":"text","text":"Ultima risposta"}]}}
            {"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read"}]}}
            """
        var asked = ""
        let fromFile = VoiceTurn.report(payload: json(["session_id": "s2", "transcript_path": "/t.jsonl"])) { asked = $0; return Data(tail.utf8) }
        XCTAssertEqual(asked, "/t.jsonl")
        XCTAssertEqual(fromFile?.text, "Ultima risposta.")

        XCTAssertNil(VoiceTurn.report(payload: json(["session_id": "s3", "last_assistant_message": "x", "stop_hook_active": true])) { _ in nil },
                     "Stop fired again by a blocking stop hook: said once")
        XCTAssertNil(VoiceTurn.report(payload: json(["session_id": "s4"])) { _ in nil })
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
        let args = VoiceTurn.haikuArguments(prompt: "Istruzioni")
        XCTAssertEqual(args.suffix(2), ["--system-prompt", "Istruzioni"])
        XCTAssertTrue(args.contains("--safe-mode"), "no hooks in Haiku's own run: it cannot trigger the voice again")
        XCTAssertFalse(args.joined().contains("Rapporto segreto"))
        let input = VoiceTurn.haikuInput(report: "Rapporto segreto", previousTopic: "la voce")
        XCTAssertEqual(input, "<rapporto>\nRapporto segreto\n</rapporto>\n<argomento_precedente>la voce</argomento_precedente>\n")
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
        let raw = "Fatto: PR #55 su `feat/50-voce` (commit c254d67a), vedi https://github.com/x/y e Sources/CodeIsland/VoiceSpeaker.swift.\n- Prossimo passo (sì)"
        let r = try XCTUnwrap(VoiceTurn.report(payload: json(["session_id": "s", "last_assistant_message": raw])) { _ in nil })
        for bad in ["55", "c254d67a", "https", "github", "Sources/", "VoiceSpeaker", "`", "feat/"] {
            XCTAssertFalse(r.text.contains(bad), "\(bad) in «\(r.text)»")
        }
        XCTAssertTrue(r.text.contains("la modifica"))
        XCTAssertTrue(r.text.hasSuffix("Io consiglio di sì."), r.text)
        let long = String(repeating: "Una frase del rapporto. ", count: 50)
        XCTAssertLessThanOrEqual(VoiceTurn.report(payload: json(["last_assistant_message": long])) { _ in nil }!.text.count, VoiceTurn.maxSpoken)
        XCTAssertFalse(VoiceTurn.report(payload: json(["last_assistant_message": "la chiave è sk_0123456789abcdefabcd"])) { _ in nil }!.text.contains("sk_"),
                       "a key never reaches Haiku")
        XCTAssertEqual(VoiceTurn.spoken(fromHaiku: "Apri il terminale e incolla il comando.\nARGOMENTO: la voce")?.text, VoiceClean.screenNotice)
        XCTAssertEqual(VoiceTurn.spoken(fromHaiku: "La modifica #12 è pronta, capo.")?.text, "La modifica è pronta, capo.")
    }

    func testElevenLabsRequestKeyOnlyInHeader() throws {
        let cfg = VoiceTurn.Config(["voice_id": "voce123456", "speed": 1.8, "model_id": "eleven_v4_turbo"])
        let key = "sk_chiave_di_prova_123"
        let r = VoiceTurn.speechRequest(text: "Ciao", config: cfg, key: key)
        XCTAssertEqual(r.value(forHTTPHeaderField: "xi-api-key"), key)
        XCTAssertFalse(r.url!.absoluteString.contains(key))
        XCTAssertTrue(r.url!.absoluteString.contains("/text-to-speech/voce123456"))
        let body = try XCTUnwrap(r.httpBody)
        XCTAssertFalse(String(decoding: body, as: UTF8.self).contains(key))
        let o = try JSONSerialization.jsonObject(with: body) as! [String: Any]
        XCTAssertEqual(o["text"] as? String, "Ciao")
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
}
