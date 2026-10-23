// figma: 101-39266 — «vista Decisioni»: le scelte di Friday per giorno, con Annulla. Stati: conferma 101-39512, annullata
// 101-39767, annullo non riuscito 101-40016, vuoto 101-40267.
import { useState } from "react";
import type { Registro } from "../../friday";
import { avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { Dialogo } from "../base/Dialogo";
import { Icona, type NomeIcona } from "../base/Icona";
import { useNavigazione } from "../base/navigazione";
import { friday, useRegistro } from "./dati";
import { orario } from "./formato";
import { Vuoto } from "./Pezzi";
import { decisioniPerGiorno } from "./vista";

type Decisione = ReturnType<typeof decisioniPerGiorno>[number]["voci"][number];

// icona per genere (contratto: permesso, fermo, risposta, promozione, archivio, regola, altro), come nel frame 101-39266
const ICONA: Record<string, [NomeIcona, "successo" | "secondaria"]> = {
  permesso: ["spunta", "successo"], fermo: ["pausa", "secondaria"], risposta: ["persona", "secondaria"],
  promozione: ["razzo", "secondaria"], archivio: ["archivia", "secondaria"], regola: ["scudo", "secondaria"], altro: ["info", "secondaria"],
};

/** Sotto la decisione: la sessione a cui si riferisce (il progetto per promozioni e archivi, come nel disegno) e l'ora. */
function dettaglio(r: Registro, d: Decisione) {
  const c = d.chat ? r.chat.get(d.chat) : undefined;
  const chi = (d.genere === "promozione" || d.genere === "archivio" ? c?.progetto : c?.titolo) ?? c?.titolo ?? "";
  return [chi, d.t !== null ? orario(d.t) : ""].filter(Boolean).join(" · ");
}

/** Esito dell'annullo: i testi li scrive Friday in comando_fatto (101-39767, 101-40016); `riprova` rifà il comando. */
export function esitoAnnulla(e: { esito: string; testo: string }, riprova: () => void) {
  if (e.esito === "ok") avvisa({ tipo: "info", messaggio: e.testo || "Decisione annullata. La sessione aspetta te." });
  else avvisa({ tipo: "errore", messaggio: e.testo || "Friday non risponde", azione: { etichetta: "Riprova", fai: riprova } });
}

async function annulla(d: Decisione) {
  esitoAnnulla(await friday().comando("annulla", { decisione: d.id }), () => annulla(d));
}

export function Decisioni() {
  const { dati: r } = useRegistro();
  const n = useNavigazione();
  // scena di prova 101-39512: sezione «annulla:<id decisione>» apre la conferma
  const [scelta, setConferma] = useState<Decisione | string | null>(() => n.sezione?.match(/^annulla:(.+)$/)?.[1] ?? null);
  const gruppi = r ? decisioniPerGiorno(r, Date.now()) : [];
  const conferma = typeof scelta === "string" ? gruppi.flatMap((g) => g.voci).find((d) => d.id === scelta) ?? null : scelta;
  if (r && !gruppi.length) {
    return <div className="vista-friday"><Vuoto icona="libro" titolo="Friday non ha ancora deciso niente" corpo="Qui trovi ogni scelta che Friday fa da sola, e la puoi annullare." /></div>;
  }
  return (
    <div className="vista-friday">
      {gruppi.map((g) => (
        <section key={g.titolo} className="gruppo-f">
          <div className="titolo-gruppo t-xs medio secondario">{g.titolo}</div>
          {g.voci.map((d) => {
            const [icona, colore] = ICONA[d.genere] ?? ICONA.altro;
            return (
              <div key={d.id} className="voce-f">
                <Icona nome={icona} colore={colore} />
                <div className="testi">
                  <span className={`t-sm ${d.annullata ? "secondario" : ""}`}>{d.cosa}</span>
                  <span className="t-xs secondario">{dettaglio(r!, d)}</span>
                </div>
                {d.annullata ? <span className="t-sm secondario">Annullata</span>
                  : d.annullabile ? <Bottone tipo="secondario" onClick={() => setConferma(d)}>Annulla</Bottone>
                  : d.nonAnnullabile && <span className="t-sm secondario">{d.nonAnnullabile}</span>}
              </div>
            );
          })}
        </section>
      ))}
      {conferma && (
        // shortcut: il corpo è `perche` finché il contratto non dà cosa fa l'annullo (chiesto al motore: effetto_annullo)
        <Dialogo titolo="Annullare la decisione?" corpo={conferma.perche} onChiudi={() => setConferma(null)}
          bottoni={<>
            <Bottone tipo="secondario" onClick={() => setConferma(null)}>Lascia così</Bottone>
            <Bottone tipo="pericolo" onClick={() => { setConferma(null); annulla(conferma); }}>Annulla la decisione</Bottone>
          </>} />
      )}
    </div>
  );
}
