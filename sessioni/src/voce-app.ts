// Clotch assente (#339, contratto Friday v1 § 4): gli avvisi che Friday dà all'app (`detto_da` diverso da «clotch») li legge l'app.
import { execFile, type ChildProcess } from "node:child_process";
import { provaSilenziosa } from "./modalita-prova";
import { leggeLApp, type Registro } from "./friday";

/** Avvisi nuovi da leggere a voce. `visti` = id già passati; la prima volta (null) segna tutto come visto: lo storico non si legge. */
export function daLeggere(r: Registro, visti: Set<string> | null, ora = Date.now()): { testi: string[]; visti: Set<string> } {
  const nuovi = visti ? r.avvisi.filter((a) => !visti.has(a.id)) : [];
  const tutti = new Set(r.avvisi.map((a) => a.id));
  const nd = r.nonDisturbare;
  if (nd && (nd.fino === null || nd.fino > ora)) return { testi: [], visti: tutti };
  return { testi: nuovi.filter(leggeLApp).map((a) => a.testo).filter(Boolean), visti: tutti };
}

const inCorso = new Set<ChildProcess>();
let cambio: () => void = () => {};
/** Chi vuole sapere quando l'app comincia o smette di parlare (101:46308); uno solo, il main. */
export const suVoceApp = (cb: () => void) => { cambio = cb; };
/** L'app sta dicendo un avviso a voce adesso. */
export const staParlando = () => inCorso.size > 0;
/** «Interrompi» (101:46308): ferma le frasi in corso. */
export function fermaVoce() { [...inCorso].forEach((p) => p.kill()); }

/** Voce di sistema del Mac; altrove niente (la sandbox Linux non ha voce). */
export function leggi(testo: string) {
  if (provaSilenziosa()) return;
  if (process.platform !== "darwin") return;
  const p = execFile("say", [testo], () => { inCorso.delete(p); cambio(); });
  inCorso.add(p);
  cambio();
}
