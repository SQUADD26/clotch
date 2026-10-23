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
const ascoltatori = new Set<(parla: boolean) => void>();
const cambiata = () => ascoltatori.forEach((f) => f(inCorso.size > 0));

/** L'app sta dicendo un avviso adesso (frame «sta parlando»): serve al renderer per «Interrompi». */
export const staParlando = () => inCorso.size > 0;
export function suVoce(f: (parla: boolean) => void) { ascoltatori.add(f); return () => { ascoltatori.delete(f); }; }
/** Ferma la voce dell'app (`say`): ogni frase in corso esce con errore e il callback la toglie dall'insieme. */
export function interrompiVoce() { inCorso.forEach((c) => c.kill()); }

/** Voce di sistema del Mac; altrove niente (la sandbox Linux non ha voce). */
export function leggi(testo: string) {
  if (provaSilenziosa()) return;
  if (process.platform !== "darwin") return;
  const c: ChildProcess = execFile("say", [testo], () => { inCorso.delete(c); cambiata(); });
  inCorso.add(c);
  cambiata();
}
