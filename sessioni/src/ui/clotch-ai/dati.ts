// Registro di clotch AI nel renderer: `window.clotchAi` (preload.ts), con lo stesso stato carica/pronto/errore di base/dati.ts.
import { useSyncExternalStore } from "react";
import type { Registro } from "../../clotch-ai";
import type { ClotchAiApi } from "../../tipi";
import { messaggioErrore } from "../base/dati";
import { applicaParziale, daPiano } from "./registro";

declare global {
  interface Window { clotchAi: ClotchAiApi }
}
export const clotchAi = (): ClotchAiApi => window.clotchAi;

/** Un negozio piccolo: valore, chi ascolta, `metti` per cambiarlo. */
export function negozio<T>(iniziale: T) {
  let v = iniziale;
  const ascolta = new Set<() => void>();
  return {
    get: () => v,
    metti: (n: T) => { v = n; ascolta.forEach((f) => f()); },
    usa: () => useSyncExternalStore((f) => { ascolta.add(f); return () => { ascolta.delete(f); }; }, () => v),
    segui: (f: () => void) => { ascolta.add(f); return () => { ascolta.delete(f); }; },
  };
}

type StatoRegistro = { stato: "carica" | "pronto" | "errore"; dati?: Registro; errore?: string };
const registro = negozio<StatoRegistro>({ stato: "carica" });
let collegato = false;
const leggi = () => clotchAi().registro().then(
  (p) => registro.metti({ stato: "pronto", dati: daPiano(p) }),
  (e) => registro.metti({ stato: "errore", dati: registro.get().dati, errore: messaggioErrore(e) }),
);

function collega() {
  if (collegato) return;
  collegato = true;
  leggi();
  // il main manda solo le parti cambiate (#474); senza un registro di partenza si rilegge intero
  clotchAi().onRegistro((p: any) => {
    const prima = registro.get().dati;
    if (!p?.parziale) registro.metti({ stato: "pronto", dati: daPiano(p) });
    else if (prima) registro.metti({ stato: "pronto", dati: applicaParziale(prima, p) });
    else leggi();
  });
}

/** Il registro, uno solo per tutta l'app: letto una volta, poi aggiornato da ogni `clotch-ai:registro` del main. */
export function useRegistro() {
  collega();
  return { ...registro.usa(), riprova: () => { registro.metti({ stato: "carica" }); leggi(); } };
}

/** Per chi non è un componente: `cb` col registro ora (se c'è, subito dopo l'iscrizione, mai dentro) e a ogni cambio; torna la funzione per staccarsi. */
export function seguiRegistro(cb: (r: Registro) => void): () => void {
  collega();
  let vivo = true, dato = false;
  const manda = () => { const r = registro.get().dati; if (vivo && r) { dato = true; cb(r); } };
  // in microtask: il chiamante che usa `off` dentro `cb` l'ha già in mano; se un cambio è arrivato prima, non si richiama
  queueMicrotask(() => { if (!dato) manda(); });
  const fuori = registro.segui(manda);
  return () => { vivo = false; fuori(); };
}

/** Stato che il registro non ha: l'app sta avviando clotch AI («Avvio…», «Riavvio…»). */
const avvio = negozio<"avvio" | "riavvio" | null>(null);
export const useAvvio = avvio.usa;

/** `friday avvia`; «Avvio…» resta finché il registro non mostra clotch AI viva (lo toglie `fineAvvio`). */ // nome del protocollo del motore
export async function avviaClotchAi(come: "avvio" | "riavvio") {
  avvio.metti(come);
  const r = await clotchAi().avvia().catch((e) => ({ ok: false, testo: messaggioErrore(e) }));
  if (!r?.ok) avvio.metti(null);
  return r ?? { ok: false, testo: "clotch AI non risponde" };
}
export const fineAvvio = () => { if (avvio.get()) avvio.metti(null); };
/** Scena di prova: «Avvio…» o «Riavvio…» senza lanciare niente. */
export const avviaScena = (come: "avvio" | "riavvio") => avvio.metti(come);
