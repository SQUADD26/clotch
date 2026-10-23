// Registro di Friday nel renderer: `window.friday` (preload.ts), con lo stesso stato carica/pronto/errore di base/dati.ts.
import { useSyncExternalStore } from "react";
import type { Registro } from "../../friday";
import type { FridayApi } from "../../tipi";
import { messaggioErrore } from "../base/dati";
import { daPiano } from "./registro";

declare global {
  interface Window { friday: FridayApi }
}
export const friday = (): FridayApi => window.friday;

/** Un negozio piccolo: valore, chi ascolta, `metti` per cambiarlo. */
export function negozio<T>(iniziale: T) {
  let v = iniziale;
  const ascolta = new Set<() => void>();
  return {
    get: () => v,
    metti: (n: T) => { v = n; ascolta.forEach((f) => f()); },
    usa: () => useSyncExternalStore((f) => { ascolta.add(f); return () => { ascolta.delete(f); }; }, () => v),
  };
}

type StatoRegistro = { stato: "carica" | "pronto" | "errore"; dati?: Registro; errore?: string };
const registro = negozio<StatoRegistro>({ stato: "carica" });
let collegato = false;
const leggi = () => friday().registro().then(
  (p) => registro.metti({ stato: "pronto", dati: daPiano(p) }),
  (e) => registro.metti({ stato: "errore", dati: registro.get().dati, errore: messaggioErrore(e) }),
);

/** Il registro, uno solo per tutta l'app: letto una volta, poi aggiornato da ogni `friday:registro` del main. */
export function useRegistro() {
  if (!collegato) {
    collegato = true;
    leggi();
    friday().onRegistro((p) => registro.metti({ stato: "pronto", dati: daPiano(p) }));
  }
  return { ...registro.usa(), riprova: () => { registro.metti({ stato: "carica" }); leggi(); } };
}

/** Stato che il registro non ha: l'app sta avviando Friday («Avvio…», «Riavvio…»). */
const avvio = negozio<"avvio" | "riavvio" | null>(null);
export const useAvvio = avvio.usa;

/** `friday avvia`; «Avvio…» resta finché il registro non mostra Friday viva (lo toglie `fineAvvio`). */
export async function avviaFriday(come: "avvio" | "riavvio") {
  avvio.metti(come);
  const r = await friday().avvia().catch((e) => ({ ok: false, testo: messaggioErrore(e) }));
  if (!r.ok) avvio.metti(null);
  return r;
}
export const fineAvvio = () => { if (avvio.get()) avvio.metti(null); };
/** Scena di prova: «Avvio…» o «Riavvio…» senza lanciare niente. */
export const avviaScena = (come: "avvio" | "riavvio") => avvio.metti(come);
