// figma: 101-10369 — Impostazioni · Account; «Rimuovi» chiede conferma (101-22095), poi l'avviso «Cartella rimossa» con «Annulla»: 101-10461.
import { useEffect, useState } from "react";
import { percorsiAccount } from "../../account-percorsi";
import type { CartellaAccount } from "../../tipi";
import { avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { messaggioErrore, useAggiornamenti, useChiamata } from "../base/dati";
import { Dialogo } from "../base/Dialogo";
import { Icona } from "../base/Icona";
import { Carica, ErroreLista, Gruppo, Pagina, VuotoLista } from "./controlli";
import { prova } from "./prova";
import { imposta, leggi, useImpostazioni } from "./stato";

/** Cartelle da leggere: quelle trovate dal main, più le aggiunte, meno le tolte; numeri ed errori dal main. */
function useCartelle() {
  const v = useImpostazioni();
  const radici = useChiamata(() => window.impostazioni.radici(), []);
  const percorsi = radici.dati && percorsiAccount(radici.dati, v.accountAggiunti, v.accountTolti);
  const chiave = percorsi?.join("\n");
  // senza radici la lettura resta «in corso» (il loro errore lo dice `radici`)
  const cartelle = useChiamata(() => (percorsi ? window.impostazioni.cartelle(percorsi) : new Promise<CartellaAccount[]>(() => {})), [chiave]);
  useAggiornamenti(() => cartelle.ricarica());
  return radici.stato === "errore" ? { stato: "errore" as const, errore: radici.errore, dati: undefined, riprova: radici.riprova } : cartelle;
}

function rimuovi(percorso: string) {
  imposta("accountTolti", [...leggi("accountTolti"), percorso]);
  avvisa({ tipo: "info", messaggio: "Cartella rimossa", azione: { etichetta: "Annulla", fai: () => imposta("accountTolti", leggi("accountTolti").filter((x) => x !== percorso)) } });
}

export async function aggiungi(tolti: string[], aggiunti: string[]) {
  try {
    const p = await window.impostazioni.scegliCartella();
    if (!p) return;
    if (tolti.includes(p)) imposta("accountTolti", tolti.filter((x) => x !== p));
    else if (!aggiunti.includes(p) && !(await window.impostazioni.radici()).includes(p)) imposta("accountAggiunti", [...aggiunti, p]);
    else return void avvisa({ tipo: "info", messaggio: "Cartella già in elenco" });
    avvisa({ tipo: "info", messaggio: "Cartella aggiunta" });
  } catch (e) { avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }); }
}

export default function Account() {
  const v = useImpostazioni();
  const lette = useCartelle();
  const cartelle = lette.dati;
  const [daRimuovere, setDaRimuovere] = useState<string | null>(prova?.rimuovi ?? null);
  useEffect(() => { if (prova?.dopoRimuovi) avvisa({ tipo: "info", messaggio: "Cartella rimossa", azione: { etichetta: "Annulla", fai: () => {} } }); }, []);
  return (
    <Pagina titolo="Account">
      <div className="t-base secondario">Le cartelle degli account da cui leggere le sessioni di Claude Code.</div>
      {lette.stato === "errore" && !lette.dati ? <Gruppo><ErroreLista titolo="Cartelle non lette" errore={lette.errore} riprova={lette.riprova} /></Gruppo>
        : !cartelle ? <Gruppo><Carica testo="Caricando le cartelle degli account…" /></Gruppo>
        : !cartelle.length ? <Gruppo><VuotoLista titolo="Nessuna cartella" corpo="Aggiungi la cartella di un account Claude Code per leggerne le sessioni." /></Gruppo>
        : (
        <Gruppo>
          {cartelle.map((c) => (
            <div key={c.percorso} className="riga azione">
              <Icona nome="cartella" />
              <div className="testi">
                <div className="t-sm">{c.percorso}</div>
                <div className={`t-sm ${c.errore ? "errore" : "secondario"}`}>{c.dettaglio}</div>
              </div>
              <Bottone tipo="secondario" aria-label={`Rimuovi ${c.percorso}`} onClick={() => setDaRimuovere(c.percorso)}>Rimuovi</Bottone>
            </div>
          ))}
        </Gruppo>
      )}
      <Bottone onClick={() => aggiungi(v.accountTolti, v.accountAggiunti)}>Aggiungi cartella</Bottone>
      {daRimuovere && (
        <Dialogo titolo="Rimuovere la cartella?" corpo={`Le sessioni di ${daRimuovere} non vengono più lette. I file restano dove sono.`} onChiudi={() => setDaRimuovere(null)}
          bottoni={<>
            <Bottone tipo="secondario" onClick={() => setDaRimuovere(null)}>Annulla</Bottone>
            <Bottone tipo="pericolo" onClick={() => { rimuovi(daRimuovere); setDaRimuovere(null); }}>Rimuovi</Bottone>
          </>} />
      )}
    </Pagina>
  );
}
