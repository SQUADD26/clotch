import XCTest
@testable import ClotchCore

/// #299: the voice says which job it speaks of, never an alert Roberto can do nothing about, and English words the Italian way.
final class VoiceClearLinesTests: XCTestCase {
    private let question = VoiceEvent(kind: .question, at: Date(), subject: "Config, voce fuori Clean View",
                                      text: "Obiettivo: Clean View non parla più, l'unica voce è Clotch. Confermi?")
    private let custom = VoiceEvent(kind: .custom, at: Date(), subject: "claude-config: Il guard #2072 blocca le risposte",
                                    text: "Non ho aperto la sessione per claude-config: adesso non si puo', riprova tra poco.")

    func testReportNamesTheJob() {
        XCTAssertTrue(question.report.contains("Config, voce fuori Clean View"), question.report)
    }

    func testAlertWithNothingToDoIsNotSaid() {
        var engine = VoiceAlertEngine()
        XCTAssertEqual(engine.offer(custom, config: .init([:]), sessions: [], now: Date()), "niente da fare per Roberto")
        XCTAssertNil(engine.offer(question, config: .init([:]), sessions: [], now: Date()), "a real question still goes through")
    }

    func testVagueLineWithoutTheJobIsRefused() {
        XCTAssertTrue(VoiceTurn.vague("Mi confermi se funziona?", subject: question.subject))
        XCTAssertTrue(VoiceTurn.vague("Riprova tra poco.", subject: custom.subject))
        XCTAssertFalse(VoiceTurn.vague("Su Clean View la voce non parla più: mi confermi se funziona?", subject: question.subject))
        XCTAssertFalse(VoiceTurn.vague("Mi serve il tuo sì per il merge.", subject: question.subject))
    }

    func testFridayIsLeftToTheItalianVoice() {
        let said = VoiceTurn.pronounced("Friday apre un worktree dopo l'handoff", VoiceTurn.builtInPronunciation)
        XCTAssertEqual(said, "Friday apre un worktree dopo l'handoff")
    }

    func testVoiceKnowsItIsTheRightHand() {
        let input = VoiceTurn.haikuInput(report: question.report, previousTopic: "")
        XCTAssertTrue(input.contains("<ruolo>Sei \(VoiceTurn.voiceName), il braccio destro di Roberto"), input)
        XCTAssertTrue(input.contains("prima persona"))
    }

    func testLineThatAsksAndAnswersItselfIsRefused() {
        XCTAssertTrue(VoiceTurn.selfAnswered("Ti serve dirmi qualcosa adesso? No, questo era soltanto un avviso."))
        XCTAssertTrue(VoiceTurn.selfAnswered("Confermi? Sì, va bene."))
        XCTAssertFalse(VoiceTurn.selfAnswered("Mi serve un tuo sì sul disegno del notch: lo approvi?"))
    }

    func testRoleHasNoWordBanOnlyContentRule() {
        XCTAssertTrue(VoiceTurn.role.contains("Le parole tecniche vanno bene"))
        XCTAssertTrue(VoiceTurn.role.contains("niente numeri di PR"))
    }

    /// #299: every spoken line goes through `speechRequest`, so the English names stay as written in all of them.
    func testFridayGoesToElevenLabsAsWritten() throws {
        let r = VoiceTurn.speechRequest(text: "Ho aperto Friday sul nodo giusto", config: .init([:]), key: "k", pronunciation: VoiceTurn.builtInPronunciation)
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(r.httpBody)) as? [String: Any])
        XCTAssertEqual(body["text"] as? String, "Ho aperto Friday sul nodo giusto")
    }

    /// #312: real lines of `eventi.jsonl` (subjects and texts): «Overseer» never reaches ElevenLabs, whatever the place in the line.
    func testOverseerNeverReachesTheSynthesis() throws {
        let real = ["Overseer, obiettivi motore Clotch", "8 cose aspettano te e l'Overseer non gira: riaprilo.", "Causa provata e mandata all'Overseer Correzione scritta",
                    "Config, Overseer insegue obiettivo", "Clotch, disegno Impostazioni Overseer", "Dall'Overseer, stessa classe di #2192, da includere: S-0228."]
        for line in real {
            let r = VoiceTurn.speechRequest(text: line, config: .init([:]), key: "k", pronunciation: VoiceTurn.builtInPronunciation)
            let body = try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(r.httpBody)) as? [String: Any])
            let text = try XCTUnwrap(body["text"] as? String)
            XCTAssertFalse(text.lowercased().contains("overseer"), text)
            XCTAssertTrue(text.contains("Friday"), text)
        }
    }
}
