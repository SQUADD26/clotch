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
        let all: [VoiceInput.Failure] = [.mic, .key, .credits, .network, .local, .off, .shortcut, .doNotDisturb, .nothingHeard]
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

    /// #269: black team 22/10, «16.4 s of audio, 0 words» and the bar closed mute; a quick tap is still Roberto's choice (#147).
    func testSixteenSecondsOfNothingIsNotHeard() {
        XCTAssertTrue(VoiceInput.heardNothing(seconds: 16.4, words: 0, peak: 0.6), "no words after a long recording")
        XCTAssertTrue(VoiceInput.heardNothing(seconds: 16.4, words: 0, peak: 0), "the stale microphone: no words, level at zero")
        XCTAssertTrue(VoiceInput.heardNothing(seconds: 5, words: 3, peak: 0), "words but a level that never moved")
        XCTAssertFalse(VoiceInput.heardNothing(seconds: 0.6, words: 0, peak: 0), "a tap is a choice (#147)")
        XCTAssertFalse(VoiceInput.heardNothing(seconds: VoiceInput.heardAfter, words: 0, peak: 0), "after more than the threshold, not at it")
        XCTAssertFalse(VoiceInput.heardNothing(seconds: 16, words: 12, peak: 0.4), "a normal dictation")
        XCTAssertEqual(VoiceInput.Failure.nothingHeard.title, "Non ho sentito niente")
    }

    /// #269: the spare microphone made before an audio change is bound to the old setup and hears nothing.
    func testASpareOlderThanTheAudioChangeIsMadeAgain() {
        let now = Date(timeIntervalSince1970: 10_000)
        let made = now.addingTimeInterval(-60)
        XCTAssertTrue(VoiceInput.spareIsStale(madeAt: made, changedAt: now.addingTimeInterval(-10), now: now), "changed after it was made")
        XCTAssertFalse(VoiceInput.spareIsStale(madeAt: made, changedAt: now.addingTimeInterval(-120), now: now), "changed before it was made")
        XCTAssertFalse(VoiceInput.spareIsStale(madeAt: made, changedAt: .distantPast, now: now), "no change seen")
        XCTAssertTrue(VoiceInput.spareIsStale(madeAt: now.addingTimeInterval(-VoiceInput.spareMaxAge - 1), changedAt: .distantPast, now: now), "too old")
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

    func testHelperRunsOnlyItsOwnCommand() {
        let a = VoiceRoute.helperArguments(prompt: "istruzioni")
        let allowed = a[a.firstIndex(of: "--allowed-tools")! + 1].split(separator: ",").map(String.init)
        XCTAssertEqual(allowed, ["Read", "Glob", "Grep", "Bash(python3 hooks/helper_voce.py:*)"])
        for write in ["Write", "Edit", "NotebookEdit", "gh "] { XCTAssertFalse(a.joined().contains(write), write) }
        XCTAssertEqual(a[a.firstIndex(of: "--model")! + 1], VoiceRoute.askModel)
        XCTAssertEqual(a[a.firstIndex(of: "--max-budget-usd")! + 1], "0.10")
        XCTAssertTrue(a.contains("--no-session-persistence"))
        XCTAssertEqual(a.suffix(2), ["--system-prompt", "istruzioni"])
        XCTAssertEqual(VoiceRoute.helperPromptPath, ".claude/hooks/helper_voce_prompt.md")
    }

    func testOverseerModelIsChosenInTheSettings() {
        XCTAssertEqual(VoiceInput.Config([:]).overseerModel, "claude-haiku-5-5")
        XCTAssertEqual(VoiceInput.Config(["overseer_modello": "claude-opus-5-5"]).overseerModel, "claude-opus-5-5")
        XCTAssertEqual(VoiceInput.Config(["overseer_modello": "gpt-9"]).overseerModel, "claude-haiku-5-5", "a model Clotch does not know: Haiku")
        let a = VoiceRoute.helperArguments(prompt: "p", model: "claude-opus-5-5")
        XCTAssertEqual(a[a.firstIndex(of: "--model")! + 1], "claude-opus-5-5")
        XCTAssertEqual(a[a.firstIndex(of: "--max-budget-usd")! + 1], "0.60")
        XCTAssertEqual(VoiceRoute.budget("claude-sonnet-5-5"), "0.30")
        XCTAssertEqual(VoiceRoute.helperSeconds("claude-haiku-5-5"), 90)
        XCTAssertEqual(VoiceRoute.helperSeconds("claude-sonnet-5-5"), 150)
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

    /// #242: the sentences the local engine heard in the live tests of 22/10, and words that must stay.
    func testSystemNamesAreFixedAfterTheEngine() {
        XCTAssertEqual(VoiceInput.fixNames("Di Allover Saird e la prova dal vivo della dettatura di Cloche è passata."),
                       "Di a Friday e la prova dal vivo della dettatura di Clotch è passata.")
        XCTAssertEqual(VoiceInput.fixNames("Di Allover Seyer che la prova della dettatura di Cloce è passata"),
                       "Di a Friday che la prova della dettatura di Clotch è passata")
        XCTAssertEqual(VoiceInput.fixNames("Oversayer, questa è una prova dettata da Cloch."), "Friday, questa è una prova dettata da Clotch.")
        XCTAssertEqual(VoiceInput.fixNames("Che cosa fanno le sessioni di cloch?"), "Che cosa fanno le sessioni di Clotch?")
        XCTAssertEqual(VoiceInput.fixNames("Over sire, chiudi"), "Friday, chiudi")
        for same in ["game over", "un lover", "la sessione di Friday", "Friday", "clock e orologio"] {
            XCTAssertEqual(VoiceInput.fixNames(same), same)
        }
    }

    /// #271: the forms of the black team of 22/10 that passed mangled.
    func testMoreMangledNames() {
        XCTAssertEqual(VoiceInput.fixNames("Clutch, che cosa fanno le sessioni?"), "Clotch, che cosa fanno le sessioni?")
        XCTAssertEqual(VoiceInput.fixNames("API Master, dammi lo stato"), "apri-master, dammi lo stato")
        XCTAssertEqual(VoiceInput.fixNames("Dì a apri master di fermarsi"), "Dì a apri-master di fermarsi")
        XCTAssertEqual(VoiceInput.fixNames("apri-master"), "apri-master")
    }
}
