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

    func testFridayIsSaidTheEnglishWay() {
        let said = VoiceTurn.pronounced("Friday apre un worktree dopo l'handoff", VoiceTurn.builtInPronunciation)
        XCTAssertEqual(said, "fràidei apre un uòrk trì dopo l'hènd off")
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

    /// #299: every spoken line goes through `speechRequest`, so the English names are respelled in all of them.
    func testFridayGoesToElevenLabsRespelled() throws {
        let r = VoiceTurn.speechRequest(text: "Ho aperto Friday sul nodo giusto", config: .init([:]), key: "k", pronunciation: VoiceTurn.builtInPronunciation)
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(r.httpBody)) as? [String: Any])
        XCTAssertEqual(body["text"] as? String, "Ho aperto fràidei sul nodo giusto")
    }
}
