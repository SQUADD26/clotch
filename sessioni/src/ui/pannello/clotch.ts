// «Clotch acceso?» per tutta l'interfaccia (#350, coppie CL1–CL10): un solo posto, letto dal registro di clotch AI (`window.clotchAi`).
import type { Registro } from "../../clotch-ai";
import type { ClotchAiApi } from "../../tipi";

/** Uguale a CLOTCH_SPENTO_MS di clotch-ai.ts, che usa node:fs e non entra nel renderer. */
const SPENTO_MS = 600_000;

/** Ultimo evento `clotch` con voce accesa e più giovane di 10 min (contratto v1). */
export const acceso = (r: Pick<Registro, "clotch">, ora: number) => !!r.clotch && r.clotch.voce === "accesa" && ora - r.clotch.t <= SPENTO_MS;

let stato = false;
let ultimo: Pick<Registro, "clotch"> = { clotch: null };
let avviato = false;
const ascoltatori = new Set<(a: boolean) => void>();

function aggiorna(r: Pick<Registro, "clotch">) {
  ultimo = r;
  const a = acceso(r, Date.now());
  if (a === stato) return;
  stato = a;
  ascoltatori.forEach((cb) => cb(a));
}

function avvia() {
  const f = (globalThis as { clotchAi?: ClotchAiApi }).clotchAi;
  if (avviato || !f) return;
  avviato = true;
  const da = (p: any) => aggiorna({ clotch: p?.clotch ?? null }); // serve solo `clotch`: niente Map da rifare a ogni evento
  f.registro().then(da, () => {}); // registro non leggibile: resta «assente», come senza Clotch
  f.onRegistro(da);
  setInterval(() => aggiorna(ultimo), 60_000); // i 10 min scadono anche senza eventi nuovi
}

/** Vero se Clotch è acceso secondo il registro di clotch AI. */
export function clotchAcceso(): boolean {
  avvia();
  return stato;
}

/** Richiama `cb` a ogni cambio; torna la funzione per staccarsi. */
export function suClotch(cb: (acceso: boolean) => void): () => void {
  avvia();
  ascoltatori.add(cb);
  return () => { ascoltatori.delete(cb); };
}
