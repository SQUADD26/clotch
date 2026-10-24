// figma: 113-51111 — «Pannello obiettivo» (Normale, Vuoto, Prova in corso, Prova fallita, File vuoti); componente 101-7436.
import { Icona, type NomeIcona } from "../base/Icona";
import "./pannello.css";

export type StatoProva = "fatta" | "attesa" | "in-corso" | "fallita";
export interface DatiPannello {
  /** null = nessun obiettivo (stato «Vuoto»). */
  obiettivo: string | null;
  /** Stato del registro (proposto, raggiunto…); «aperto» e senza obiettivo non portano etichetta. */
  stato?: string | null;
  prove: { testo: string; stato: StatoProva }[];
  /** null = la sessione non dice quali file ha toccato: la sezione non si mostra. */
  file: { quanti: number; aggiunte: number; tolte: number } | null;
}

// icona e colori di ogni stato della prova, dalle varianti del frame 113-51111
// `voce`: lo stato detto a VoiceOver, che non vede colore e icona (#866)
const PROVA: Record<StatoProva, { icona: NomeIcona; colore: "successo" | "terziaria" | "accento" | "errore"; testo: string; voce: string }> = {
  fatta: { icona: "finita", colore: "successo", testo: "", voce: "fatta" },
  attesa: { icona: "orologio", colore: "terziaria", testo: "secondario", voce: "in attesa" },
  "in-corso": { icona: "spinner", colore: "accento", testo: "secondario", voce: "in corso" },
  fallita: { icona: "avviso", colore: "errore", testo: "errore", voce: "non riuscita" },
};

// etichetta e colore di ogni stato del registro oltre ad «aperto» (stesso significato della chat: raggiunto/passato = finita)
const STATO: Record<string, { testo: string; colore: "successo" | "errore" | "avviso" | "secondario" }> = {
  proposto: { testo: "Proposto", colore: "avviso" },
  raggiunto: { testo: "Raggiunto", colore: "successo" },
  bloccato: { testo: "Bloccato", colore: "errore" },
  passato: { testo: "Passato", colore: "secondario" },
  rifiutato: { testo: "Rifiutato", colore: "secondario" },
};

export function PannelloObiettivo({ dati }: { dati: DatiPannello }) {
  const { obiettivo, prove, file } = dati;
  const stato = obiettivo ? STATO[dati.stato ?? ""] : undefined;
  return (
    <section className="pannello-obiettivo">
      <div className="sezione">
        <div className="titolo-stato"><span className="t-base medio">Obiettivo</span>{stato && <span className={`t-xs stato-obiettivo ${stato.colore}`}>{stato.testo}</span>}</div>
        <div className="t-sm secondario">{obiettivo ?? "Nessun obiettivo. clotch AI lo propone quando capisce il lavoro della sessione."}</div>
      </div>
      <div className="divisore" />
      <div className="sezione prove" role="list" aria-label="Prove">
        <div className="t-base medio">Prove</div>
        {prove.length === 0 && <div className="t-sm secondario">Nessuna prova</div>}
        {prove.map((p, i) => (
          <div key={i} className="prova" role="listitem" aria-label={`${p.testo}: ${PROVA[p.stato].voce}`}>
            <Icona nome={PROVA[p.stato].icona} colore={PROVA[p.stato].colore} gira={p.stato === "in-corso"} />
            <span className={`t-sm ${PROVA[p.stato].testo}`}>{p.testo}</span>
          </div>
        ))}
      </div>
      {file && <>
        <div className="divisore" />
        <div className="sezione">
          <div className="t-base medio">File toccati</div>
          {file.quanti === 0 ? <div className="t-sm secondario">Nessun file toccato</div> : (
            <div className="riga-file">
              <span className="t-sm secondario conteggio">{file.quanti} file</span>
              <span className="numero aggiunte">+{file.aggiunte}</span>
              <span className="numero tolte">−{file.tolte}</span>
            </div>
          )}
        </div>
      </>}
    </section>
  );
}
