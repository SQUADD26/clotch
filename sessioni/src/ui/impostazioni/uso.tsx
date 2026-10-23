// figma: 101-48825 — Impostazioni · Uso con Clotch (dati dal notch); senza Clotch: 101-48888.
// shortcut: il main non ha ancora una fonte delle quote d'uso (#374): finché `uso()` torna null il gruppo non c'è.
import { useEffect, useState } from "react";
import type { QuotaUso } from "../../tipi";
import { Icona } from "../base/Icona";
import { useClotchAcceso } from "../pannello/Pillole";
import { Gruppo, Pagina } from "./controlli";

const NOTA = {
  con: "Dati dal notch, aggiornati 1 min fa. Clotch avvisa a voce all’80% e al 90%.",
  senza: "Dati letti da Sessioni, aggiornati 1 min fa. Avviso all’80% e al 90% in un avviso a comparsa.",
};

export default function Uso() {
  const clotch = useClotchAcceso();
  const [quote, setQuote] = useState<QuotaUso[] | null>(null);
  useEffect(() => { window.impostazioni.uso().then(setQuote, () => {}); }, []);
  return (
    <Pagina titolo="Uso">
      <div className="schede" role="tablist">
        <button type="button" role="tab" aria-selected className="scheda scelta t-sm">Panoramica</button>
        {/* la scheda Andamento non è disegnata (BLOCCATO in #351) */}
        <button type="button" role="tab" aria-selected={false} className="scheda t-sm secondario" disabled>Andamento</button>
      </div>
      {quote && (
        <>
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
          <div className="nota-clotch">
            <Icona nome={clotch ? "schermo" : "grafico"} />
            <span className="t-xs secondario">{clotch ? NOTA.con : NOTA.senza}</span>
          </div>
        </>
      )}
    </Pagina>
  );
}
