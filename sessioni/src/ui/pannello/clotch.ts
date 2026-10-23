// «Clotch acceso?» per tutta l'interfaccia (#350, coppie CL1–CL10): un solo posto, letto dal registro di Friday (`window.friday`).
import type { Registro } from "../../friday";
import type { FridayApi } from "../../tipi";
import { daPiano } from "../friday/registro";

/** Uguale a CLOTCH_SPENTO_MS di friday.ts, che usa node:fs e non entra nel renderer. */
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
  const f = (globalThis as { friday?: FridayApi }).friday;
  if (avviato || !f) return;
  avviato = true;
  const da = (p: unknown) => aggiorna(daPiano(p));
  f.registro().then(da, () => {}); // registro non leggibile: resta «assente», come senza Clotch
  f.onRegistro(da);
  setInterval(() => aggiorna(ultimo), 60_000); // i 10 min scadono anche senza eventi nuovi
}

/** Vero se Clotch è acceso secondo il registro di Friday. */
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
