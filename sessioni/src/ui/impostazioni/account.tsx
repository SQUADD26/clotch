// figma: 101-10369 — Impostazioni · Account; dopo «Rimuovi», con l'avviso «Cartella rimossa» e «Annulla»: 101-10461.
import { useEffect, useState } from "react";
import type { CartellaAccount } from "../../tipi";
import { avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { messaggioErrore, useAggiornamenti } from "../base/dati";
import { Icona } from "../base/Icona";
import { Gruppo, Pagina } from "./controlli";
import { prova } from "./prova";
import { imposta, useImpostazioni } from "./stato";

/** Cartelle da leggere: quelle trovate dal main, più le aggiunte, meno le tolte; numeri ed errori dal main. */
function useCartelle(): CartellaAccount[] | null {
  const v = useImpostazioni();
  const [radici, setRadici] = useState<string[] | null>(null);
  const [cartelle, setCartelle] = useState<CartellaAccount[] | null>(null);
  const [giro, setGiro] = useState(0);
  useAggiornamenti(() => setGiro((g) => g + 1));
  useEffect(() => { window.impostazioni.radici().then(setRadici, (e) => avvisa({ tipo: "errore", messaggio: messaggioErrore(e) })); }, []);
  const percorsi = radici && [...radici, ...v.accountAggiunti.filter((p) => !radici.includes(p))].filter((p) => !v.accountTolti.includes(p));
  const chiave = percorsi?.join("\n");
  useEffect(() => {
    if (percorsi) window.impostazioni.cartelle(percorsi).then(setCartelle, (e) => avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }));
  }, [chiave, giro]);
  return cartelle;
}

function rimuovi(percorso: string, tolti: string[]) {
  imposta("accountTolti", [...tolti, percorso]);
  avvisa({ tipo: "info", messaggio: "Cartella rimossa", azione: { etichetta: "Annulla", fai: () => imposta("accountTolti", tolti) } });
}

async function aggiungi(tolti: string[], aggiunti: string[]) {
  try {
    const p = await window.impostazioni.scegliCartella();
    if (!p) return;
    if (tolti.includes(p)) imposta("accountTolti", tolti.filter((x) => x !== p));
    else if (!aggiunti.includes(p)) imposta("accountAggiunti", [...aggiunti, p]);
  } catch (e) { avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }); }
}

export default function Account() {
  const v = useImpostazioni();
  const cartelle = useCartelle();
  useEffect(() => { if (prova?.dopoRimuovi) avvisa({ tipo: "info", messaggio: "Cartella rimossa", azione: { etichetta: "Annulla", fai: () => {} } }); }, []);
  return (
    <Pagina titolo="Account">
      <div className="t-base secondario">Le cartelle ~/.claude-* da cui leggere le sessioni di Claude Code.</div>
      {cartelle && cartelle.length > 0 && (
        <Gruppo>
          {cartelle.map((c) => (
            <div key={c.percorso} className="riga azione">
              <Icona nome="cartella" />
              <div className="testi">
                <div className="t-sm">{c.percorso}</div>
                <div className={`t-sm ${c.errore ? "errore" : "secondario"}`}>{c.dettaglio}</div>
              </div>
              <Bottone tipo="secondario" onClick={() => rimuovi(c.percorso, v.accountTolti)}>Rimuovi</Bottone>
            </div>
          ))}
        </Gruppo>
      )}
      <Bottone onClick={() => aggiungi(v.accountTolti, v.accountAggiunti)}>Aggiungi cartella</Bottone>
    </Pagina>
  );
}
