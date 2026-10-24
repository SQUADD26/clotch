// figma: 101-39266 — «vista Decisioni»: le scelte di clotch AI per giorno, con Annulla. Stati: conferma 101-39512, annullata
// 101-39767, annullo non riuscito 101-40016, vuoto 101-40267.
import { useState } from "react";
import { Pezzi } from "../base/Pezzi";
import type { Registro } from "../../clotch-ai";
import { aggiornaAvviso, avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { Dialogo } from "../base/Dialogo";
import { Icona, type NomeIcona } from "../base/Icona";
import { useNavigazione } from "../base/navigazione";
import { clotchAi, useRegistro } from "./dati";
import { mentreInCorso, useInCorso } from "./inCorso";
import { orario } from "./formato";
import { Vuoto } from "./Pezzi";
import { AttesaRegistro, inAttesa } from "./StatoRegistro";
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
  return [chi, d.t !== null ? orario(d.t) : ""].filter(Boolean);
}

/** Esito dell'annullo: i testi li scrive clotch AI in comando_fatto (101-39767, 101-40016); `riprova` rifà il comando. */
export function esitoAnnulla(e: { esito: string; testo: string }, riprova: () => void, id?: number) {
  const mostra = (a: Parameters<typeof avvisa>[0]) => (id === undefined ? avvisa(a) : aggiornaAvviso(id, a));
  if (e.esito === "ok") mostra({ tipo: "info", messaggio: e.testo || "Decisione revocata. La sessione aspetta te." });
  else mostra({ tipo: "errore", messaggio: e.testo || "clotch AI non risponde", azione: { etichetta: "Riprova", fai: riprova } });
}

// «Revocando…» subito: la risposta di clotch AI può arrivare dopo secondi
async function annulla(d: Decisione) {
  const id = avvisa({ tipo: "caricamento", messaggio: "Revocando…" });
  const e = await mentreInCorso(d.id, () => clotchAi().comando("annulla", { decisione: d.id }).catch(() => ({ esito: "errore", testo: "" })));
  esitoAnnulla(e, () => annulla(d), id);
}

export function Decisioni() {
  const stato = useRegistro();
  const r = stato.dati;
  const n = useNavigazione();
  const inCorso = useInCorso();
  // scena di prova 101-39512: sezione «annulla:<id decisione>» apre la conferma
  const [scelta, setConferma] = useState<Decisione | string | null>(() => n.sezione?.match(/^annulla:(.+)$/)?.[1] ?? null);
  const gruppi = r ? decisioniPerGiorno(r, Date.now()) : [];
  const conferma = typeof scelta === "string" ? gruppi.flatMap((g) => g.voci).find((d) => d.id === scelta) ?? null : scelta;
  if (inAttesa(stato)) return <div className="vista-clotch-ai"><AttesaRegistro s={stato} /></div>;
  if (r && !gruppi.length) {
    return <div className="vista-clotch-ai"><Vuoto icona="libro" titolo="Nessuna decisione" corpo="Le scelte di clotch AI compaiono qui e si possono revocare." /></div>;
  }
  return (
    <div className="vista-clotch-ai">
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
                  <span className="t-xs secondario"><Pezzi parti={dettaglio(r!, d)} /></span>
                </div>
                {d.annullata ? <span className="t-sm secondario">Revocata</span>
                  : d.annullabile ? <Bottone tipo="secondario" caricamento={inCorso.has(d.id)} onClick={() => setConferma(d)}>Revoca</Bottone>
                  : d.nonAnnullabile && <span className="t-sm secondario">{d.nonAnnullabile}</span>}
              </div>
            );
          })}
        </section>
      ))}
      {conferma && (
        <Dialogo titolo="Revocare la decisione?" corpo={conferma.effettoAnnullo || conferma.perche || `Torna tutto come prima di «${conferma.cosa}».`} onChiudi={() => setConferma(null)}
          bottoni={<>
            <Bottone tipo="secondario" onClick={() => setConferma(null)}>Annulla</Bottone>
            <Bottone tipo="pericolo" onClick={() => { setConferma(null); annulla(conferma); }}>Revoca decisione</Bottone>
          </>} />
      )}
    </div>
  );
}
