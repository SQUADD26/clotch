// figma: 101-48825 — Impostazioni · Uso (Panoramica) con Clotch (dati dal notch); senza Clotch: 101-48888; scheda Andamento: 119-57613.
// shortcut: il main non ha ancora una fonte delle quote d'uso (#374): finché `uso()` torna null il gruppo non c'è.
import { useEffect, useState } from "react";
import type { QuotaUso } from "../../tipi";
import { Icona } from "../base/Icona";
import { useClotchAcceso } from "../pannello/Pillole";
import { Gruppo, Pagina } from "./controlli";
import { prova } from "./prova";
import "./uso.css";

const NOTA = {
  con: "Dati dal notch, aggiornati 1 min fa. Clotch avvisa a voce all’80% e al 90%.",
  senza: "Dati letti da Sessioni, aggiornati 1 min fa. Avviso all’80% e al 90% in un avviso a comparsa.",
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
            <span className={`t-sm ${pieno ? "errore" : "secondario"}`}>{q.ripartenza}</span>
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
  return (
    <Gruppo>
      <div className="andamento">
        <div className="testata">
          <span className="t-base medio">Ultimi {giorni.length} giorni</span>
          <span className="t-sm secondario">Uso al giorno per account</span>
        </div>
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
  useEffect(() => { window.impostazioni.uso().then(setQuote, () => {}); }, []);
  return (
    <Pagina titolo="Uso">
      <div className="schede" role="tablist">
        {SCHEDE.map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={scheda === id} className={`tab-uso t-sm ${scheda === id ? "scelta" : "secondario"}`}
            onClick={() => setScheda(id)}>{nome}</button>
        ))}
      </div>
      {quote && (scheda === "panoramica" ? <Panoramica quote={quote} /> : <Andamento quote={quote} />)}
      {quote && scheda === "panoramica" && (
        <div className="nota-uso">
          <Icona nome={clotch ? "schermo" : "grafico"} />
          <span className="t-xs secondario">{clotch ? NOTA.con : NOTA.senza}</span>
        </div>
      )}
    </Pagina>
  );
}
