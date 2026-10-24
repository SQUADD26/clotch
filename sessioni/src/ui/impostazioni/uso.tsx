// figma: 101-48825 — Impostazioni · Uso (Panoramica) con Clotch (dati dal notch); senza Clotch: 101-48888; scheda Andamento: 119-57613.
// Dati veri dal feed di Clotch (quote-uso.ts, #374). Lettura in corso, errore con «Riprova» e nessun account: righe di stato nel gruppo (#952).
// shortcut: il feed non dà l'uso al giorno, quindi la scheda Andamento resta vuota; quando la fonte ha la serie (`giorni`), si disegna da sola.
import { useEffect, useRef, useState } from "react";
import type { QuotaUso } from "../../tipi";
import { fa } from "../../uso-testi";
import { useAggiornamenti, useChiamata } from "../base/dati";
import { Icona } from "../base/Icona";
import { useOra } from "../chat/clotch-ai";
import { useClotchAcceso } from "../pannello/Pillole";
import { Carica, ErroreLista, Gruppo, Pagina, VuotoLista } from "./controlli";
import { prova } from "./prova";
import "./uso.css";

const NOTA = {
  con: (quando: string) => `Dati dal notch, aggiornati ${quando}. clotch avvisa a voce all’80% e al 90%.`,
  senza: (quando: string) => `Dati letti da clotch, aggiornati ${quando}. Avviso all’80% e al 90% in un avviso a comparsa.`,
};

type Scheda = "panoramica" | "andamento";
const SCHEDE: [Scheda, string][] = [["panoramica", "Panoramica"], ["andamento", "Andamento"]];
// un colore per account, nell'ordine della legenda del frame, poi gli altri colori di sessione (#953)
// shortcut: oltre 6 account i colori si ripetono; se capita davvero, un tratteggio per il secondo giro
const COLORI = ["blu", "arancione", "viola", "verde", "grigio", "rosso"];
const numero = new Intl.NumberFormat("it-IT", { notation: "compact" });
const data = (giorno: string, opz: Intl.DateTimeFormatOptions) => new Date(giorno).toLocaleDateString("it-IT", { timeZone: "UTC", ...opz });
const colore = (i: number) => `var(--colore-sessione-${COLORI[i % COLORI.length]})`;

function Panoramica({ quote }: { quote: QuotaUso[] }) {
  return (
    <Gruppo>
      {quote.map((q) => {
        const pieno = q.usato >= 100;
        return (
          <div key={q.account} className="riga uso">
            <div className="testata">
              <span className="t-base nome-uso" title={q.account}>{q.account}</span>
              <span className={`t-sm valore-uso ${pieno ? "errore" : "secondario"}`}>{q.usato}% usato</span>
            </div>
            <div className="barra-uso" role="progressbar" aria-label={q.account} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(q.usato, 100)} aria-valuetext={`${q.usato}% usato`}><div className={pieno ? "pieno errore" : "pieno"} style={{ width: `${Math.min(q.usato, 100)}%` }} /></div>
            {q.ripartenza && <span className={`t-sm ${pieno ? "errore" : "secondario"}`}>{q.ripartenza}</span>}
          </div>
        );
      })}
    </Gruppo>
  );
}

function Andamento({ quote }: { quote: QuotaUso[] }) {
  const giorni = quote[0]?.giorni ?? [];
  const grafico = useRef<HTMLDivElement>(null);
  useEffect(() => { if (grafico.current) grafico.current.scrollLeft = grafico.current.scrollWidth; }, [giorni.length]); // se scorre, si parte da oggi
  if (!giorni.length) return <Gruppo><VuotoLista titolo="Nessun uso registrato" corpo="L’andamento compare quando un account lavora in una sessione." /></Gruppo>;
  const totale = giorni.map((_, i) => quote.reduce((s, q) => s + (q.giorni?.[i]?.v ?? 0), 0));
  const massimo = Math.max(...totale, 1);
  const etichetta = (giorno: string, i: number) => `${data(giorno, { day: "numeric", month: "long" })}: ${quote.map((q) => `${q.account} ${numero.format(q.giorni?.[i]?.v ?? 0)} token`).join(", ")}`;
  return (
    <Gruppo>
      <div className="andamento">
        <div className="testata">
          <span className="t-base medio">Ultimi {giorni.length} giorni</span>
          <span className="t-sm secondario">Uso al giorno per account</span>
        </div>
        <div className="grafico" ref={grafico}>
          {giorni.map((g, i) => (
            // il valore di ogni barra al passaggio e per VoiceOver: giorno e token per account (#954)
            <div key={g.giorno} className="giorno" role="img" title={etichetta(g.giorno, i)} aria-label={etichetta(g.giorno, i)}>
              <div className="pila" style={{ height: `calc(var(--altezza-pila) * ${totale[i] / massimo})` }}>
                {quote.map((q, k) => <div key={q.account} style={{ flexGrow: q.giorni?.[i]?.v ?? 0, background: colore(k) }} />)}
              </div>
              <span className="t-xs secondario" aria-hidden="true">{new Date(g.giorno).getUTCDate() === 1 ? data(g.giorno, { month: "short" }) : new Date(g.giorno).getUTCDate()}</span>
            </div>
          ))}
        </div>
        <div className="legenda">
          {quote.map((q, k) => (
            <span key={q.account} className="voce-legenda">
              <span className="campione" style={{ background: colore(k) }} />
              <span className="t-sm secondario" title={q.account}>{q.account}</span>
            </span>
          ))}
        </div>
      </div>
    </Gruppo>
  );
}

export default function Uso() {
  const clotch = useClotchAcceso();
  const lette = useChiamata(() => window.impostazioni.uso(), []);
  useAggiornamenti(() => lette.ricarica()); // dati nuovi dal notch: numeri e «aggiornati … fa» seguono
  const ora = useOra();
  const quote = lette.dati ?? null;
  const [scheda, setScheda] = useState<Scheda>(prova?.scheda ?? "panoramica");
  return (
    <Pagina titolo="Uso">
      <div className="schede" role="tablist" aria-label="Vista dell’uso" onKeyDown={(e) => {
        const i = SCHEDE.findIndex(([id]) => id === scheda), d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        const vai = e.key === "Home" ? 0 : e.key === "End" ? SCHEDE.length - 1 : d ? (i + d + SCHEDE.length) % SCHEDE.length : -1;
        if (vai < 0) return;
        e.preventDefault(); setScheda(SCHEDE[vai][0]);
        queueMicrotask(() => document.querySelector<HTMLElement>('[role=tab][aria-selected=true]')?.focus());
      }}>
        {SCHEDE.map(([id, nome]) => (
          <button key={id} id={`scheda-${id}`} type="button" role="tab" aria-controls="pannello-uso" aria-selected={scheda === id} tabIndex={scheda === id ? 0 : -1} className={`tab-uso t-sm ${scheda === id ? "scelta" : "secondario"}`}
            onClick={() => setScheda(id)}>{nome}</button>
        ))}
      </div>
      <div className="pannello-uso" id="pannello-uso" role="tabpanel" aria-labelledby={`scheda-${scheda}`}>
      {lette.stato === "carica" ? <Gruppo><Carica testo="Caricando l’uso degli account…" /></Gruppo>
        : lette.stato === "errore" && !quote ? <Gruppo><ErroreLista titolo="Uso non letto" errore={lette.errore} riprova={lette.riprova} /></Gruppo>
        : !quote?.length ? <Gruppo><VuotoLista titolo="Nessun account" corpo="L’uso compare quando un account Claude Code lavora su questo Mac." /></Gruppo>
        : scheda === "panoramica" ? <Panoramica quote={quote} /> : <Andamento quote={quote} />}
      </div>
      {quote?.length && scheda === "panoramica" ? (
        <div className="nota-uso">
          <Icona nome={clotch ? "schermo" : "grafico"} />
          <span className="t-xs secondario">{(clotch ? NOTA.con : NOTA.senza)(fa(Math.max(...quote.map((q) => q.letto ?? 0)) || undefined, ora))}</span>
        </div>
      ) : null}
    </Pagina>
  );
}
