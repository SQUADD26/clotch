// Clotch assente (#339, contratto Friday v1 § 4): gli avvisi che Friday dà all'app (`detto_da` diverso da «clotch») li legge l'app.
import { execFile } from "node:child_process";
import { leggeLApp, type Registro } from "./friday";

/** Avvisi nuovi da leggere a voce. `visti` = id già passati; la prima volta (null) segna tutto come visto: lo storico non si legge. */
export function daLeggere(r: Registro, visti: Set<string> | null, ora = Date.now()): { testi: string[]; visti: Set<string> } {
  const nuovi = visti ? r.avvisi.filter((a) => !visti.has(a.id)) : [];
  const tutti = new Set(r.avvisi.map((a) => a.id));
  const nd = r.nonDisturbare;
  if (nd && (nd.fino === null || nd.fino > ora)) return { testi: [], visti: tutti };
  return { testi: nuovi.filter(leggeLApp).map((a) => a.testo).filter(Boolean), visti: tutti };
}

/** Voce di sistema del Mac; altrove niente (la sandbox Linux non ha voce). */
export function leggi(testo: string) {
  if (process.platform === "darwin") execFile("say", [testo], () => {});
}
