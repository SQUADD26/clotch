// figma: 101-14396 — lavoro e righe di stato nel filo: «Attività» 101:13368, «Aiutanti» 101:13419, «Interrotta» 101:13475 (finestra «Interrotta da te»: 101-15055),
// «Riassunto» 101:13480, «Fine turno» 101:13494, «Bloccato da una regola» 101:13532, «Non risponde» 101:13541, «Avviso» 101:7316.
import type { ReactNode } from "react";
import { Bottone } from "../base/Bottone";
import { Icona, type NomeIcona } from "../base/Icona";
import type { Aiutante, Passo } from "./modello";
import { useQuote, trova } from "../barra/account-dati";
import { comanda } from "./clotch-ai";
import { durata, nomeAccount, ora, quanti } from "./testi";
import { useRiserva } from "./riserva";
import "./lavoro.css";

const SEGNO_PASSO: Record<Passo["stato"], [NomeIcona, "successo" | "accento" | "terziaria"]> = {
  fatto: ["spunta", "successo"], "in-corso": ["in-corso", "accento"], "da-fare": ["orologio", "terziaria"],
};

function Riquadro({ icona, titolo, dettaglio, conto, children }: { icona: NomeIcona; titolo: string; dettaglio?: string | null; conto?: string; children: ReactNode }) {
  return (
    <div className="riquadro-lavoro">
      <div className="testata-lavoro">
        <Icona nome={icona} />
        <span className="titolo">{titolo}</span>
        {dettaglio && <span className="dettaglio" title={dettaglio}>{dettaglio}</span>}
        {conto && <span className="conto">{conto}</span>}
      </div>
      <div className="voci-lavoro">{children}</div>
    </div>
  );
}

export function Attivita({ passi }: { passi: Passo[] }) {
  const fatti = passi.filter((p) => p.stato === "fatto").length;
  const ris = useRiserva();
  return (
    <Riquadro icona="spunta" titolo="Attività" conto={`${fatti} su ${passi.length}`}>
      {passi.map((p, i) => (
        <div key={i} className={p.stato === "in-corso" ? "voce-lavoro attiva" : "voce-lavoro"}>
          <Icona nome={SEGNO_PASSO[p.stato][0]} colore={SEGNO_PASSO[p.stato][1]} />
          <span className="testo">{ris.testo(p.testo)}</span>
        </div>
      ))}
    </Riquadro>
  );
}

/** `modello`: dal registro di clotch AI («aiutante» con modello), se c'è. */
export function Aiutanti({ aiutanti, modello }: { aiutanti: Aiutante[]; modello: string | null }) {
  const finiti = aiutanti.every((a) => a.finito);
  const ris = useRiserva();
  const n = aiutanti.length;
  const titolo = finiti ? `${quanti(n, "aiutante", "aiutanti")} ${n === 1 ? "finito" : "finiti"}` : `${quanti(n, "aiutante", "aiutanti")} al lavoro`;
  return (
    <Riquadro icona="strati" titolo={titolo} dettaglio={modello} conto={finiti ? undefined : `${aiutanti.filter((a) => a.finito).length} su ${n}`}>
      {aiutanti.map((a) => (
        <div key={a.id} className="voce-lavoro">
          <Icona nome={a.finito ? "spunta" : "in-corso"} colore={a.finito ? "successo" : "accento"} />
          <span className="nome" title={a.nome}>{ris.testo(a.nome)}</span>
          <span className="testo">{ris.testo(a.azione)}</span>
          {a.durata != null && <span className="durata">{durata(a.durata)}</span>}
        </div>
      ))}
    </Riquadro>
  );
}

export function RigaStato({ icona, colore, esito, dettaglio }: { icona: NomeIcona; colore: "terziaria" | "successo"; esito: string; dettaglio?: string }) {
  return (
    <div className="riga-stato">
      <Icona nome={icona} colore={colore} />
      <span className="esito">{esito}</span>
      {dettaglio && <span className="dettaglio">{dettaglio}</span>}
    </div>
  );
}

export const Interrotta = () => <RigaStato icona="stop" colore="terziaria" esito="Interrotta da te" />;

/** «riga evento» (101:28708): linea, testo, linea. Il riassunto, il cambio di giorno e gli eventi della sessione sono tutti questa riga. */
export function RigaEvento({ testo }: { testo: string }) {
  return <div className="riga-evento"><span className="linea" /><span className="testo">{testo}</span><span className="linea" /></div>;
}

export const Riassunto = () => <RigaEvento testo="Conversazione riassunta per fare spazio" />;

export function FineTurno({ ms, strumenti, file, aiutanti }: { ms: number | null; strumenti: number; file: number; aiutanti: number }) {
  const parti = [
    strumenti && quanti(strumenti, "strumento", "strumenti"),
    file && quanti(file, "file", "file"),
    aiutanti && quanti(aiutanti, "aiutante", "aiutanti"),
  ].filter(Boolean).join(", ");
  return <RigaStato icona="finita" colore="successo" esito={ms != null ? `Finita in ${durata(ms)}` : "Finita"} dettaglio={parti} />;
}

/** Avvisi nel filo: bloccata (fondo attesa, scudo), non risponde e limite di uso (fondo errore). */
export function AvvisoFilo({ tipo, titolo, corpo, icona, children }: { tipo: "attesa" | "errore"; titolo: string; corpo?: string; icona?: NomeIcona; children?: ReactNode }) {
  const r = useRiserva();
  return (
    <div className={`avviso-filo ${tipo}`}>
      <Icona nome={icona ?? (tipo === "attesa" ? "scudo" : "avviso")} colore={tipo === "attesa" ? "accento" : "errore"} />
      <div className="testi">
        <div className="titolo">{r.testo(titolo)}</div>
        {corpo && <div className="corpo">{r.testo(corpo)}</div>}
      </div>
      {children}
    </div>
  );
}

export function NonRisponde({ da, terminale }: { da: string; terminale?: () => void }) {
  return (
    <AvvisoFilo tipo="errore" titolo="La sessione non risponde" corpo={`Nessun segnale ${da}. Il processo è ancora aperto.`}>
      {terminale && <Bottone tipo="secondario" onClick={terminale}>Apri nel terminale</Bottone>}
    </AvvisoFilo>
  );
}

/** Quando riparte, col giorno se non è oggi: «alle 12:01», «giovedì alle 12:01». */
function quando(ms: number, adesso: number) {
  const g = new Date(ms), oggi = new Date(adesso);
  const stessoGiorno = g.toDateString() === oggi.toDateString();
  return `${stessoGiorno ? "" : `${g.toLocaleDateString("it-IT", { weekday: "long" })} `}alle ${ora(ms)}`;
}

export function Limite({ chat, chiave, ripartenza, adesso }: { chat: string; chiave: string; ripartenza: number | null; adesso: number }) {
  const quote = useQuote() ?? [];
  const questo = trova(quote, chiave);
  const altri = quote.filter((q) => q !== questo && q.email).slice(0, 3); // un pulsante per account, come `riprendi_altrove` del menu account
  const nome = nomeAccount(chiave);
  const passato = ripartenza != null && ripartenza <= adesso;
  const corpo = passato ? `L’account ${nome} può ripartire.`
    : ripartenza != null ? `L’account ${nome} riparte ${quando(ripartenza, adesso)}.` : null;
  return (
    <AvvisoFilo tipo="errore" titolo={passato ? "Limite di uso finito" : "Limite di uso raggiunto"} corpo={[corpo, altri.length ? "Oppure riprendi la sessione con un altro account." : null].filter(Boolean).join(" ") || undefined}>
      {altri.map((q) => <Bottone key={q.email} tipo="secondario" onClick={() => void comanda("riprendi_altrove", { chat, account: q.email })}>{`Riprendi con ${q.account}`}</Bottone>)}
    </AvvisoFilo>
  );
}
