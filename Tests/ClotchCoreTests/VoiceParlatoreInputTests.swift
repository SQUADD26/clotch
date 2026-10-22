import XCTest
@testable import ClotchCore

/// #204: what Haiku receives from Clotch is what Clean View's parlatore receives (voce-parlatore.ts:100), and what it answers is
/// cleaned of the advice mark and of opinions anywhere in the sentence.
final class VoiceParlatoreInputTests: XCTestCase {
    func testQuestionInputNamesTheJobAndHasNoAdviceMark() {
        let e = VoiceEvent(kind: .question, at: Date(), subject: "Clotch, correzioni notch",
                           text: "Apri Figma, riga ADHD (42-): scegli A, B o C. Con la tua scelta faccio il codice. A (sì).")
        let input = VoiceTurn.haikuInput(report: e.report, context: e.context, previousTopic: "")
        XCTAssertTrue(input.contains("Clotch, correzioni notch"), "the job is named: «\(input)»")
        XCTAssertTrue(input.contains("<dire_argomento>sì</dire_argomento>"), input)
        XCTAssertFalse(input.contains("(sì)"), "the raw mark never reaches Haiku: «\(input)»")
    }

    func testGoalPrefixIsSaidOnce() {
        let e = VoiceEvent(kind: .goalReached, at: Date(), subject: "Clotch", text: "Obiettivo raggiunto: Harness del banco pilota")
        XCTAssertEqual(e.report.components(separatedBy: "Obiettivo raggiunto").count - 1, 1, e.report)
        XCTAssertEqual(VoiceEvent(kind: .goalReached, at: Date(), text: "Harness fatto").report, "Obiettivo raggiunto: Harness fatto.")
    }

    func testAdviceAnywhereInTheSentenceNeverReachesTheVoice() {
        let said = VoiceTurn.spoken(fromHaiku: "Devi scegliere tra tre opzioni. Alla fine per me conviene la prima, capo. Scegli la prima (sì). Ti consiglio di aspettare.\nARGOMENTO: le scelte")
        XCTAssertEqual(said?.text, "Devi scegliere tra tre opzioni. Scegli la prima.")
    }
}
