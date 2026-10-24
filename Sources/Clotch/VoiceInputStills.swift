import Foundation
import ClotchCore

/// The pill's states for `--snapshot --gallery` (#110), in the order of the Figma notes: 1 «Parla pure», 2 «Ti ascolto», 3 «Trascrivo»
/// (3b a long text that fades at the top, 3c «Penso…»), 4 «Invio a Friday» with «Annulla · 2», 5 and 6 the errors, then the others.
extension VoiceInputController {
    @MainActor static var stills: [(String, VoiceInputController)] {
        let bars = [0.2, 0.5, 0.8, 0.4, 0.9, 0.6, 0.3, 0.7]
        let said = "Dimmi a che punto è la PR del notch e se ci sono errori nella compilazione"
        let long = "Quando hai un momento guarda la sessione che sta lavorando sulla voce in ingresso e dimmi se la scheda Dettatura è pronta, poi chiedi a clotch AI di avvisare la master Clotch che può compilare sul Mac, e infine controlla che il modo tieni premuto funzioni con ⌥Spazio"
        func fail(_ why: VoiceInput.Failure) -> VoiceInputController { .still(.failure(why)) }
        return [
            ("1-parla-pure", .still(.ready)),
            ("2-ti-ascolto", .still(.listening, levels: bars, elapsed: 4)),
            ("3-trascrivo", .still(.listening, sure: "Dimmi a che punto è la PR", maybe: "del notch", levels: bars)),
            ("3b-testo-lungo", .still(.listening, sure: long, levels: bars)),
            ("3c-penso", .still(.thinking, sure: said)),
            ("4-invio-annulla", .still(.sending, sure: said, elapsed: 0.5)),
            ("risposta", .still(.result("La PR 118 è in bozza: la scheda Dettatura è pronta, manca solo la prova sul Mac."))),
            ("5-errore-microfono", fail(.mic)),
            ("6-errore-chiave", fail(.key)),
            ("6b-errore-crediti", fail(.credits)),
            ("6c-errore-rete", fail(.network)),
            ("6d-errore-locale", fail(.local)),
            ("8-non-e-la-voce", fail(.notYou)),
            ("8b-voce-incerta", fail(.unsure)),
            ("8c-manca-impronta", fail(.noVoiceprint)),
            ("8d-mac-bloccato", fail(.locked)),
        ]
    }
}
