// Un solo elenco delle sessioni per finestra (#474): una richiesta al main, poi ogni aggiornamento lo corregge sul posto con le sole sessioni cambiate.
// Prima ogni useElenco (9 pezzi) richiedeva l'elenco intero a ogni evento. Una sessione uguale resta lo stesso oggetto: le righe non si ridisegnano.
import type { Aggiornamento, Elenco, Sessione } from "../../tipi";

/** Le sessioni cambiate applicate all'elenco: lo stesso oggetto se nulla cambia, null se la correzione non basta (si rilegge). */
export function applicaElenco(e: Elenco | undefined, c: Aggiornamento["elenco"], valida: (s: unknown) => boolean): Elenco | null {
  if (!e || !c || !Array.isArray(c.cambiate) || !Array.isArray(c.tolte)) return null;
  const per = new Map(e.sessioni.map((s) => [s.id, s]));
  let cambiato = false;
  for (const id of c.tolte) cambiato = per.delete(id) || cambiato;
  for (const s of c.cambiate as Sessione[]) {
    if (!valida(s)) continue;
    const v = per.get(s.id);
    if (v && JSON.stringify(v) === JSON.stringify(s)) continue;
    per.set(s.id, s);
    cambiato = true;
  }
  // stesso ordine del main (leggiElenco): la più recente prima
  return cambiato ? { ...e, sessioni: [...per.values()].sort((a, b) => b.ultimaAttivita - a.ultimaAttivita) } : e;
}
