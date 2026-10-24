// Righe con un comando in volo (revoca, salvataggio di una regola): il bottone resta spento finché l'esito non arriva (#1050).
import { negozio } from "./dati";

const chiavi = negozio<ReadonlySet<string>>(new Set());
export const useInCorso = chiavi.usa;

export async function mentreInCorso<T>(chiave: string, fai: () => Promise<T>): Promise<T> {
  chiavi.metti(new Set(chiavi.get()).add(chiave));
  try { return await fai(); } finally { const s = new Set(chiavi.get()); s.delete(chiave); chiavi.metti(s); }
}
