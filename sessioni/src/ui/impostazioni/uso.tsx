// figma: 101-48825 — Impostazioni · Uso (Panoramica) con Clotch (dati dal notch); senza Clotch: 101-48888; scheda Andamento: 119-57613, vuota: 155-74479.
// Dati veri dal feed di Clotch (quote-uso.ts, #374). Errore del feed: nessun numero (nessun testo di errore disegnato).
// shortcut: il feed non dà l'uso al giorno, quindi la scheda Andamento mostra «Nessun uso registrato» (155-74479); quando la fonte ha la serie (`giorni`), si disegna da sola.
import { useEffect, useState } from "react";
import type { QuotaUso } from "../../tipi";
import { fa } from "../../uso-testi";
import { Icona } from "../base/Icona";
import { useClotchAcceso } from "../pannello/Pillole";
import { Gruppo, Pagina, VuotoLista } from "./controlli";
import { prova } from "./prova";
import "./uso.css";

const NOTA = {
  con: (quando: string) => `Dati dal notch, aggiornati ${quando}. clotch avvisa a voce all’80% e al 90%.`,
  senza: (quando: string) => `Dati letti da clotch, aggiornati ${quando}. Avviso all’80% e al 90% in un avviso a comparsa.`,
};

type Scheda = "panoramica" | "andamento";
const SCHEDE: [Scheda, string][] = [["panoramica", "Panoramica"], ["andamento", "Andamento"]];
// un colore per account, nell'ordine della legenda del frame
const COLORI = ["blu", "arancione", "viola", "verde"];
const colore = (i: number) => `var(--colore-sessione-${COLORI[i % COLORI.length]})`;

function Panoramica({ quote }: { quote: QuotaUso[] }) {
  return (
    <Gruppo>
      {quote.map((q) => {
        const pieno = q.usato >= 100;
        return (
          <div key={q.account} className="riga uso">
            <div className="testata">
              <span className="t-base">{q.account}</span>
              <span className={`t-sm ${pieno ? "errore" : "secondario"}`}>{q.usato}% usato</span>
            </div>
            <div className="barra-uso"><div className={pieno ? "pieno errore" : "pieno"} style={{ width: `${Math.min(q.usato, 100)}%` }} /></div>
            {q.ripartenza && <span className={`t-sm ${pieno ? "errore" : "secondario"}`}>{q.ripartenza}</span>}
          </div>
        );
      })}
    </Gruppo>
  );
}

function Andamento({ quote }: { quote: QuotaUso[] }) {
  const giorni = quote[0]?.giorni ?? [];
  const totale = giorni.map((_, i) => quote.reduce((s, q) => s + (q.giorni?.[i]?.v ?? 0), 0));
  const massimo = Math.max(...totale, 1);
  const testata = (
    <div className="testata">
      <span className="t-base medio">Ultimi {giorni.length || 14} giorni</span>
      <span className="t-sm secondario">Uso al giorno per account</span>
    </div>
  );
  if (!giorni.length) return <Gruppo><div className="andamento">{testata}<VuotoLista titolo="Nessun uso registrato" corpo="L’andamento compare quando un account lavora in una sessione." /></div></Gruppo>;
  return (
    <Gruppo>
      <div className="andamento">
        {testata}
        <div className="grafico">
          {giorni.map((g, i) => (
            <div key={g.giorno} className="giorno">
              <div className="pila" style={{ height: `calc(var(--altezza-pila) * ${totale[i] / massimo})` }}>
                {quote.map((q, k) => <div key={q.account} style={{ flexGrow: q.giorni?.[i]?.v ?? 0, background: colore(k) }} />)}
              </div>
              <span className="t-xs secondario">{new Date(g.giorno).getUTCDate()}</span>
            </div>
          ))}
        </div>
        <div className="legenda">
          {quote.map((q, k) => (
            <span key={q.account} className="voce-legenda">
              <span className="campione" style={{ background: colore(k) }} />
              <span className="t-sm secondario">{q.account}</span>
            </span>
          ))}
        </div>
      </div>
    </Gruppo>
  );
}

export default function Uso() {
  const clotch = useClotchAcceso();
  const [quote, setQuote] = useState<QuotaUso[] | null>(null);
  const [scheda, setScheda] = useState<Scheda>(prova?.scheda ?? "panoramica");
  useEffect(() => { window.impostazioni.uso().then(setQuote, () => setQuote(null)); }, []);
  return (
    <Pagina titolo="Uso">
      <div className="schede" role="tablist" onKeyDown={(e) => {
        const i = SCHEDE.findIndex(([id]) => id === scheda), d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault(); setScheda(SCHEDE[(i + d + SCHEDE.length) % SCHEDE.length][0]);
        queueMicrotask(() => document.querySelector<HTMLElement>('[role=tab][aria-selected=true]')?.focus());
      }}>
        {SCHEDE.map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={scheda === id} tabIndex={scheda === id ? 0 : -1} className={`tab-uso t-sm ${scheda === id ? "scelta" : "secondario"}`}
            onClick={() => setScheda(id)}>{nome}</button>
        ))}
      </div>
      {quote && (scheda === "panoramica" ? <Panoramica quote={quote} /> : <Andamento quote={quote} />)}
      {quote?.length && scheda === "panoramica" ? (
        <div className="nota-uso">
          <Icona nome={clotch ? "schermo" : "grafico"} />
          <span className="t-xs secondario">{(clotch ? NOTA.con : NOTA.senza)(fa(Math.max(...quote.map((q) => q.letto ?? 0)) || undefined, Date.now()))}</span>
        </div>
      ) : null}
    </Pagina>
  );
}
