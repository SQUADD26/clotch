// figma: 101-10369 — Impostazioni · Account; dopo «Rimuovi», con l'avviso «Cartella rimossa» e «Annulla»: 101-10461.
import { useEffect, useState } from "react";
import { avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { messaggioErrore, useElenco } from "../base/dati";
import { Icona } from "../base/Icona";
import { Gruppo, Pagina } from "./controlli";
import { ACCOUNT_PROVA, inParita, prova } from "./prova";
import { imposta, useImpostazioni } from "./stato";

interface Cartella { percorso: string; dettaglio: string; errore: boolean }

/** Cartelle da leggere: quelle trovate dal main, più le aggiunte, meno le tolte; numeri ed errori dall'elenco. */
function useCartelle(): Cartella[] | null {
  const v = useImpostazioni();
  const elenco = useElenco();
  const [radici, setRadici] = useState<{ percorso: string; account: string }[] | null>(null);
  useEffect(() => {
    if (!inParita) window.impostazioni.radici().then(setRadici, (e) => avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }));
  }, []);
  if (inParita) return ACCOUNT_PROVA.filter((c) => !(prova?.dopoRimuovi && c.percorso === "~/.claude-friday"));
  if (!radici || elenco.stato === "carica") return null;
  const percorsi = [...radici.map((r) => r.percorso), ...v.accountAggiunti.filter((p) => !radici.some((r) => r.percorso === p))]
    .filter((p) => !v.accountTolti.includes(p));
  return percorsi.map((percorso) => {
    const account = percorso.split("/").pop()!;
    const err = elenco.dati?.errori.find((e) => e.percorso.split("/").includes(account));
    if (err) return { percorso, dettaglio: `Non leggibile: ${err.messaggio}`, errore: true };
    const n = elenco.dati?.sessioni.filter((s) => s.sorgente === "claude-code" && s.account === account).length ?? 0;
    return { percorso, dettaglio: `${n} sessioni · letta ora`, errore: false };
  });
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
