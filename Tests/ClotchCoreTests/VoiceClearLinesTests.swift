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

    func testOverseerIsNotLeftToTheFrench() {
        let said = VoiceTurn.pronounced("L'Overseer apre un worktree dopo l'handoff", VoiceTurn.builtInPronunciation)
        XCTAssertEqual(said, "L'ouver sìr apre un uòrk trì dopo l'hènd off")
    }

    func testVoiceKnowsItIsTheRightHand() {
        let input = VoiceTurn.haikuInput(report: question.report, previousTopic: "")
        XCTAssertTrue(input.contains("<ruolo>Sei \(VoiceTurn.voiceName), il braccio destro di Roberto"), input)
        XCTAssertTrue(input.contains("prima persona"))
    }
}
