import Foundation
import ClotchCore

/// The AFK examples of the Figma section «✅ Scelta definitiva · AFK», for `--snapshot --gallery` only: the files exist
/// only after a real absence, and the frames must compare one to one with the drawing.
enum AfkSample {
    private static func at(_ h: Int, _ m: Int) -> Double {
        Calendar.current.date(bySettingHour: h, minute: m, second: 0, of: Date())!.timeIntervalSince1970
    }

    private static func pr(_ n: Int) -> String { "https://github.com/SQUADD26/clotch/pull/\(n)" }

    static var summary: AfkReport {
        AfkReport(summary: AfkSummary(t: at(15, 34), inizio: at(13, 52), n: 3,
                                      frase: "Sono entrate 2 PR: avviso di aggiornamento e impostazioni. Un obiettivo è bloccato: manca la chiave di ElevenLabs."),
                  items: [
                    AfkItem(t: at(15, 20), tipo: "fine_turno", sessione: "⌘ Clotch: avviso di aggiornamento", localId: "local_afk1",
                            titolo: "Avviso di versione nuova", testo: "Avviso pronto: quando esce una versione nuova compare in alto nel notch, con il bottone «Aggiorna»."),
                    AfkItem(t: at(15, 31), tipo: "pr_unita", titolo: "Avviso di versione nuova",
                            testo: "Entrata la PR con l’avviso di aggiornamento.", link: pr(105)),
                    AfkItem(t: at(15, 10), tipo: "obiettivo_bloccato", sessione: "⌕ Ricerca: voci ElevenLabs", localId: "local_afk2",
                            titolo: "Voci italiane a confronto", testo: "Manca la chiave di ElevenLabs su questo Mac: senza, non posso provare le 3 voci."),
                  ])
    }

    static var long: AfkReport {
        AfkReport(summary: AfkSummary(t: at(15, 34), inizio: at(9, 0), n: 8,
                                      frase: "Sono entrate 6 PR, tutte su Clotch. Il puntino sulle richieste nuove e la voce che abbassa la musica sono pronti. La build firmata passa la notarizzazione. Nessun obiettivo bloccato."),
                  items: [
                    AfkItem(t: at(14, 48), tipo: "richiesta_fatta", sessione: "◰ Clotch: correzioni notch", localId: "local_afk3",
                            titolo: "Puntino sulla richiesta nuova", testo: "La richiesta appena arrivata ha un puntino finché non la apri."),
                    AfkItem(t: at(15, 2), tipo: "pr_unita", titolo: "Puntino sulla richiesta nuova",
                            testo: "Entrata la PR del puntino e della risposta sotto ogni richiesta.", link: pr(91)),
                    AfkItem(t: at(12, 52), tipo: "obiettivo_raggiunto", sessione: "⌘ Clotch: voce", localId: "local_afk4",
                            titolo: "Voce più educata", testo: "Quando la voce parla, la musica e gli altri suoni si abbassano e poi tornano su da soli."),
                    AfkItem(t: at(13, 20), tipo: "pr_unita", titolo: "Voce più educata",
                            testo: "Entrata la PR: prompt e pronuncia presi dalla config.", link: pr(88)),
                    AfkItem(t: at(10, 5), tipo: "fine_turno", sessione: "⌘ Clotch: firma e notarizzazione", localId: "local_afk5",
                            titolo: "Build firmata", testo: "La build firmata passa la notarizzazione di Apple."),
                    AfkItem(t: at(10, 40), tipo: "pr_unita", titolo: "Build firmata", testo: "Entrata la PR della firma.", link: pr(84)),
                    AfkItem(t: at(9, 30), tipo: "fine_turno", sessione: "⌘ Clotch: impostazioni", localId: "local_afk6",
                            titolo: "Impostazioni nuove", testo: "Le pagine Generale, Notch e Avvisi seguono il disegno approvato."),
                    AfkItem(t: at(9, 50), tipo: "pr_unita", titolo: "Impostazioni nuove", testo: "Entrata la PR delle impostazioni.", link: pr(80)),
                  ])
    }

    static var nothing: AfkReport {
        AfkReport(summary: AfkSummary(t: at(15, 34), inizio: at(15, 9), n: 0, frase: AfkSummary.nothing), items: [])
    }
}
