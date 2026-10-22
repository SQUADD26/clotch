import XCTest
@testable import ClotchCore

/// #110: the settings, the Scribe wire format, the live text and where the dictated text goes.
final class VoiceInputTests: XCTestCase {
    // MARK: settings

    func testConfigDefaultsAndOddValues() {
        XCTAssertEqual(VoiceInput.Config([:]), VoiceInput.Config(["ingresso_motore": "scribe", "ingresso_lingua": "it", "ingresso_a_voce": true]))
        let odd = VoiceInput.Config(["ingresso_motore": "whisper", "ingresso_lingua": "klingon", "ingresso_a_voce": "sì"])
        XCTAssertEqual(odd.engine, .scribe)
        XCTAssertEqual(odd.language, "it")
        XCTAssertTrue(odd.spoken)
    }

    func testConfigReadsLocalEngineAndAutoLanguage() {
        let c = VoiceInput.Config(["ingresso_motore": "locale", "ingresso_lingua": "auto", "ingresso_a_voce": false])
        XCTAssertEqual(c.engine, .local)
        XCTAssertEqual(c.language, "auto")
        XCTAssertFalse(c.spoken)
    }

    func testConfigDictationPage() {
        let d = VoiceInput.Config([:])
        XCTAssertEqual(d.mode, .hold, "hold the key is the default of the design")
        XCTAssertTrue(d.enabled)
        XCTAssertEqual(d.microphone, "")
        let c = VoiceInput.Config(["ingresso_modo": "premi", "ingresso_acceso": false, "ingresso_microfono": "BuiltInMicrophoneDevice"])
        XCTAssertEqual(c.mode, .toggle)
        XCTAssertFalse(c.enabled)
        XCTAssertEqual(c.microphone, "BuiltInMicrophoneDevice")
        XCTAssertEqual(VoiceInput.Config(["ingresso_modo": "boh"]).mode, .hold)
    }

    // MARK: audio

    func testPcmRoundTripAndLevel() {
        let silence = VoiceInput.pcm16([Float](repeating: 0, count: 1600))
        XCTAssertEqual(silence.count, 3200)
        XCTAssertEqual(VoiceInput.level(pcm16: silence), 0)
        let loud = VoiceInput.pcm16([Float](repeating: 0.5, count: 1600))
        XCTAssertEqual(VoiceInput.level(pcm16: loud), 1, "a steady 0.5 is clamped to the top")
        let soft = VoiceInput.level(pcm16: VoiceInput.pcm16([Float](repeating: 0.05, count: 1600)))
        XCTAssertEqual(soft, 0.25, accuracy: 0.01)
        XCTAssertEqual(VoiceInput.level(pcm16: Data()), 0)
        XCTAssertEqual(VoiceInput.pcm16([2, -2]).withUnsafeBytes { $0.loadUnaligned(as: Int16.self) }, 32767, "out of range samples are clamped")
    }

    // MARK: Scribe

    func testScribeURL() {
        let it = VoiceInput.scribeURL(language: "it").absoluteString
        XCTAssertTrue(it.hasPrefix("wss://api.elevenlabs.io/v1/speech-to-text/realtime?"))
        for part in ["model_id=scribe_v2_realtime", "audio_format=pcm_16000", "commit_strategy=manual", "language_code=it"] {
            XCTAssertTrue(it.contains(part), part)
        }
        XCTAssertFalse(VoiceInput.scribeURL(language: "auto").absoluteString.contains("language_code"))
    }

    func testScribeChunkCarriesTheAudioAndTheCommit() throws {
        let pcm = Data([1, 2, 3, 4])
        let o = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(VoiceInput.scribeChunk(pcm: pcm, commit: true).utf8)) as? [String: Any])
        XCTAssertEqual(o["message_type"] as? String, "input_audio_chunk")
        XCTAssertEqual(o["audio_base_64"] as? String, "AQIDBA==")
        XCTAssertEqual(o["commit"] as? Bool, true)
        XCTAssertEqual(o["sample_rate"] as? Int, 16000)
    }

    func testScribeEvents() {
        XCTAssertEqual(VoiceInput.scribeEvent(#"{"message_type":"session_started","session_id":"s","config":{}}"#), .started)
        XCTAssertEqual(VoiceInput.scribeEvent(#"{"message_type":"partial_transcript","text":"ciao"}"#), .partial("ciao"))
        XCTAssertEqual(VoiceInput.scribeEvent(#"{"message_type":"committed_transcript","text":"ciao a tutti"}"#), .committed("ciao a tutti"))
        XCTAssertEqual(VoiceInput.scribeEvent(#"{"message_type":"committed_transcript_with_timestamps","text":"x","words":[]}"#), .committed("x"))
        XCTAssertEqual(VoiceInput.scribeEvent(#"{"message_type":"auth_error","error":"bad key"}"#), .failure(.key))
        XCTAssertEqual(VoiceInput.scribeEvent(#"{"message_type":"quota_exceeded","error":"x"}"#), .failure(.credits))
        XCTAssertEqual(VoiceInput.scribeEvent(#"{"message_type":"transcriber_error","error":"x"}"#), .failure(.network))
        XCTAssertEqual(VoiceInput.scribeEvent(#"{"message_type":"warning","warning":"w"}"#), .ignored)
        XCTAssertEqual(VoiceInput.scribeEvent("not json"), .ignored)
        XCTAssertEqual(VoiceInput.scribeEvent(#"{"message_type":"something_new"}"#), .ignored)
    }

    /// Figma #110 note 5 and 6: a title, a cause and the move that fixes it; never a code.
    func testFailuresSpeakPlainlyAndOfferTheFix() {
        let all: [VoiceInput.Failure] = [.mic, .key, .credits, .network, .local]
        for f in all {
            XCTAssertNil((f.title + f.detail).range(of: #"\d{3}|HTTP|error|errore"#, options: .regularExpression), "\(f)")
            XCTAssertFalse(f.actions.isEmpty)
        }
        XCTAssertEqual(VoiceInput.Failure.key.title, "La chiave di ElevenLabs non funziona")
        XCTAssertEqual(VoiceInput.Failure.key.actions.map(\.label), ["Controlla la chiave", "Usa il modello locale"])
        XCTAssertEqual(VoiceInput.Failure.credits.actions, [.useLocal])
        XCTAssertEqual(VoiceInput.Failure.network.actions, [.retry, .useLocal])
        XCTAssertEqual(VoiceInput.Failure.mic.actions.map(\.label), ["Apri Privacy › Microfono"])
        XCTAssertEqual(VoiceInput.scribeEvent(#"{"message_type":"rate_limited","error":"x"}"#), .failure(.network))
        // #147: no voice to hear is Roberto's choice, not a failure.
        XCTAssertEqual(VoiceInput.scribeEvent(#"{"message_type":"insufficient_audio_activity","error":"x"}"#), .quiet)
    }

    func testDictationKeepsCommittedAndShowsThePartial() {
        var d = VoiceInput.Dictation()
        d.take(.partial("a che pun"))
        XCTAssertEqual(d.text, "a che pun")
        d.take(.partial("a che punto siamo"))
        d.take(.committed(" a che punto siamo "))
        XCTAssertEqual(d.text, "a che punto siamo")
        d.take(.partial("con il notch"))
        XCTAssertEqual(d.text, "a che punto siamo con il notch")
        d.take(.committed("   "))
        XCTAssertEqual(d.text, "a che punto siamo", "an empty commit drops the partial and adds nothing")
        d.replace(with: "tutto il testo")
        XCTAssertEqual(d.text, "a che punto siamo tutto il testo")
    }

    // MARK: routing

    func testQuestionsGoToTheReadOnlyModel() {
        for t in ["A che punto siamo con il notch?", "a che punto siamo", "Cosa sta facendo la master di Friday?", "Quante richieste sono aperte",
                  "Perché non usa la chiave?", "dimmi lo stato delle PR", "Come mai la sessione è ferma"] {
            XCTAssertEqual(VoiceRoute.classify(t), .question, t)
        }
    }

    func testOrdersGoToTheOverseer() {
        for t in ["Apri una sessione per sistemare il login", "Fai partire la promozione di Clotch", "Voglio che la voce parli più piano",
                  "Controlla le PR aperte e uniscile", "Serve una sessione sul calendario", "boh, il notch", String(repeating: "parola ", count: 80)] {
            XCTAssertEqual(VoiceRoute.classify(t), .order, t)
        }
    }

    func testConfirmationsAreNotes() {
        XCTAssertEqual(VoiceRoute.classify("Ok grazie"), .note)
        XCTAssertEqual(VoiceRoute.classify("va bene, perfetto"), .note)
        XCTAssertEqual(VoiceRoute.classify("ok, ma perché?"), .question)
    }

    func testOrderPhrasedAsQuestionStaysAQuestion() {
        // The registry's rule: «?» plus an interrogative opening wins over the action verb.
        XCTAssertEqual(VoiceRoute.classify("Perché non usa la chiave?"), .question)
        XCTAssertEqual(VoiceRoute.classify("Apri una sessione, cosa serve?"), .order, "an action verb without an interrogative opening is an order")
    }

    // MARK: inbox and read-only ask

    func testInboxFileCarriesTheOrder() throws {
        let at = Date(timeIntervalSince1970: 1_800_000_000.5)
        XCTAssertEqual(VoiceRoute.inboxName(id: "ab12", at: at), "1800000000500-ab12.json")
        let o = try XCTUnwrap(JSONSerialization.jsonObject(with: VoiceRoute.inboxPayload(id: "ab12", text: "Apri una sessione", at: at)) as? [String: Any])
        XCTAssertEqual(o["v"] as? Int, 1)
        XCTAssertEqual(o["id"] as? String, "ab12")
        XCTAssertEqual(o["testo"] as? String, "Apri una sessione")
        XCTAssertEqual(o["da"] as? String, "clotch-voce")
        XCTAssertEqual(o["t"] as? Int, 1_800_000_000_500)
    }

    func testAskCanOnlyRead() {
        let a = VoiceRoute.askArguments()
        let tools = a[a.firstIndex(of: "--tools")! + 1].split(separator: ",").map(String.init)
        XCTAssertEqual(Set(tools), ["Read", "Glob", "Grep", "Bash"])
        let allowed = a[a.firstIndex(of: "--allowed-tools")! + 1].split(separator: ",").map(String.init)
        XCTAssertEqual(allowed.filter { $0.hasPrefix("Bash") }.count, 4)
        XCTAssertTrue(allowed.filter { $0.hasPrefix("Bash") }.allSatisfy { $0.hasPrefix("Bash(gh issue ") || $0.hasPrefix("Bash(gh pr ") })
        for write in ["Write", "Edit", "NotebookEdit"] { XCTAssertFalse(a.joined().contains(write), write) }
        XCTAssertTrue(a.contains("--no-session-persistence"))
        XCTAssertEqual(a.last, VoiceRoute.askPrompt)
        XCTAssertEqual(VoiceRoute.askInput("che ore sono"), "<sessioni>\n\n</sessioni>\n<domanda>\nche ore sono\n</domanda>\n")
    }

    func testAskGetsTheSessionsClotchSees() {
        let now = Date()
        let line = VoiceRoute.sessionLine(title: "Clotch: voce", status: .running, lastActivity: now.addingTimeInterval(-180), now: now)
        XCTAssertEqual(line, "- Clotch: voce: lavora, ultima attività 3 min fa")
        XCTAssertTrue(VoiceRoute.askInput("quante sessioni?", sessions: [line]).hasPrefix("<sessioni>\n\(line)\n</sessioni>\n"))
        XCTAssertFalse(VoiceRoute.askPrompt.contains("local_*.json"))
    }

    func testListenerFreshnessAndOverseerId() {
        let now = Date()
        XCTAssertFalse(VoiceRoute.listenerIsFresh(modified: nil, now: now))
        XCTAssertTrue(VoiceRoute.listenerIsFresh(modified: now.addingTimeInterval(-30), now: now))
        XCTAssertFalse(VoiceRoute.listenerIsFresh(modified: now.addingTimeInterval(-120), now: now))
        XCTAssertEqual(VoiceRoute.overseerLocalId(Data(#"{"cli":"c","local_id":"local_ab","storia":[]}"#.utf8)), "local_ab")
        XCTAssertNil(VoiceRoute.overseerLocalId(Data(#"{"cli":"c","local_id":""}"#.utf8)))
        XCTAssertNil(VoiceRoute.overseerLocalId(Data("garbage".utf8)))
    }

    func testInboxFilesLiveUnderTheVoiceFolder() {
        let f = VoiceFiles(home: URL(fileURLWithPath: "/h"))
        XCTAssertEqual(f.inboxURL.path, "/h/.config/voce/ingresso")
        XCTAssertEqual(f.inboxListenerURL.path, "/h/.config/voce/ingresso/.ascolta")
        XCTAssertEqual(f.overseerURL.path, "/h/.claude/overseer/attuale.json")
    }
}
