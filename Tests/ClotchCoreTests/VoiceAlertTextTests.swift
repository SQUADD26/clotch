import XCTest
@testable import ClotchCore

/// #235, #236: the line under the notch reads the engine's own event lines (dipendenze.py, richieste_adhd.py), never a guess.
final class VoiceAlertTextTests: XCTestCase {
    private func line(_ json: String) throws -> VoiceEvent { try XCTUnwrap(VoiceEvents.parse(line: Substring(json))) }

    func testWaitsForOkNamesTheSessionAndWhat() throws {
        let e = try line(#"{"v": 1, "id": "e-1", "t": 1792670000, "tipo": "aspetta_ok", "livello": "alto", "sessione": {"cli": "c", "local_id": "", "titolo": "⌘ Setup: test", "ruolo": "master"}, "soggetto": "Setup", "testo": "Setup aspetta un tuo ok per scegliere come fare i test della pagina prezzi: vuoi che glielo dia io?", "prova": "local_abc"}"#)
        let t = try XCTUnwrap(VoiceAlertText(e))
        XCTAssertEqual(t.label, "Setup aspetta il tuo ok")
        XCTAssertEqual(t.text, "Scegliere come fare i test della pagina prezzi.")
        XCTAssertEqual(t.actions, [.giveOk, .openChat])
        XCTAssertEqual(t.localId, "local_abc", "the session id rides in `prova` when `sessione.local_id` is empty")
    }

    func testStalledDependencyAndTitleWithoutIcon() throws {
        let e = try line(#"{"v": 1, "id": "e-2", "t": 1792670000, "tipo": "dipendenza_ferma", "livello": "alto", "sessione": {"cli": "c", "local_id": "local_x", "titolo": "⌘ SEO: report", "ruolo": "master"}, "soggetto": "", "testo": "Una sessione aspetta te da troppo: il motore si è fermato, serve una persona.", "prova": "D-1"}"#)
        let t = try XCTUnwrap(VoiceAlertText(e))
        XCTAssertEqual(t.label, "SEO: report aspetta te")
        XCTAssertEqual(t.text, "Il motore si è fermato, serve una persona.")
        XCTAssertEqual(t.actions, [.openChat])
        XCTAssertEqual(t.localId, "local_x")
    }

    func testAdhdAnswerSplitsQuestionFromAnswer() throws {
        let e = try line(#"{"v": 1, "id": "e-3", "t": 1792670000, "tipo": "risposta_adhd", "livello": "alto", "soggetto": "Perche' il notch e' nero?", "testo": "Risposta a: Perche' il notch e' nero? Perche' manca il tema scuro.", "prova": "Q-1"}"#)
        let t = try XCTUnwrap(VoiceAlertText(e))
        XCTAssertEqual([t.text, t.detail], ["Perche' il notch e' nero?", "Perche' manca il tema scuro."])
        XCTAssertEqual(t.actions, [.openAdhd])
        let row = try XCTUnwrap(VoiceAlertText(e, question: "Perché il notch è nero?", answer: "Manca il tema scuro."))
        XCTAssertEqual([row.text, row.detail], ["Perché il notch è nero?", "Manca il tema scuro."], "the ADHD row wins over the event")
    }

    func testCutSubjectNeverSplitsMidQuestion() throws {
        let cut = String(repeating: "a", count: 80)
        let e = VoiceEvent(kind: .adhdAnswer, at: Date(), subject: cut, text: "Risposta a: \(cut)bbb? Sì.")
        let t = try XCTUnwrap(VoiceAlertText(e))
        XCTAssertEqual([t.text, t.detail], ["\(cut)bbb? Sì.", ""])
    }

    func testOtherKindsHaveNoLine() {
        XCTAssertNil(VoiceAlertText(VoiceEvent(kind: .requestDone, at: Date(), subject: "x")))
    }
}
