// figma: 101-23727 — «Azioni sulla risposta»: copia (poi spunta e «Copiato»), leggi con clotch AI, menu «…» con
// Copia testo, Copia come Markdown, Leggi con clotch AI, Mostra nel file della sessione.
import { useState } from "react";
import { BottoneIcona } from "../base/Bottone";
import { api } from "../base/dati";
import { Menu } from "../base/Menu";
import { comanda } from "./clotch-ai";
import { Markdown, senzaMarkdown } from "./Markdown";
import { useRiserva } from "./riserva";
import "./filo.css";

export { senzaMarkdown } from "./Markdown";

/** `sessione`: per «Mostra nel file della sessione»; `prova`: stato del frame 101:23727 (copiato e menu aperto). */
export function Risposta({ testo: grezzo, inScrittura, sessione, prova = false }: { testo: string; inScrittura: boolean; sessione?: string; prova?: boolean }) {
  const testo = useRiserva().testo(grezzo); // vale anche per «Copia»: dalla risposta non esce una chiave coperta
  const [copiato, setCopiato] = useState(prova);
  const [menu, setMenu] = useState(prova);
  const copia = (t: string) => navigator.clipboard.writeText(t).then(() => { setCopiato(true); setTimeout(() => setCopiato(false), 1500); });
  const leggi = () => void comanda("voce_leggi", { testo: senzaMarkdown(testo) });
  return (
    <div className="risposta">
      <div className="testo-risposta"><Markdown testo={testo} />{inScrittura && <span className="cursore" />}</div>
      {!inScrittura && (
        <div className={menu ? "azioni fisse" : "azioni"}>
          <span className="con-suggerimento">
            <BottoneIcona icona={copiato ? "spunta" : "copia"} etichetta="Copia" onClick={() => copia(senzaMarkdown(testo))} />
            {copiato && <span className="suggerimento">Copiato</span>}
          </span>
          {/* shortcut: legge la voce dell'app (`say`), non quella di Clotch: il motore non ha un comando che legga un testo (proposta: `leggi {testo}`) */}
          <BottoneIcona icona="microfono" etichetta="Leggi con clotch AI" className="al-passaggio" onClick={leggi} />
          <span className="con-menu al-passaggio">
            <BottoneIcona icona="altro" etichetta="Altro" className={menu ? "aperto" : ""} onClick={() => setMenu(!menu)} />
            {menu && (
              <Menu onChiudi={() => setMenu(false)} style={{ bottom: "100%", left: 0 }} voci={[
                { icona: "copia", etichetta: "Copia testo", fai: () => copia(senzaMarkdown(testo)) },
                { icona: "file", etichetta: "Copia come Markdown", fai: () => copia(testo) },
                { icona: "microfono", etichetta: "Leggi con clotch AI", fai: leggi },
                "separatore",
                { icona: "finder", etichetta: "Mostra nel file della sessione", fai: () => { if (sessione) void api().azione(sessione, "mostra-nel-finder"); } },
              ]} />
            )}
          </span>
        </div>
      )}
    </div>
  );
}
