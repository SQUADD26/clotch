// L'elenco segue le impostazioni salvate (#404): sorgenti accese, cartelle escluse, cronologia. Funzione pura; non cancella niente dal disco.
import * as path from "node:path";
import { PARTENZA } from "./partenza";
import { espandi } from "./radici";
import type { Elenco, ImpostazioniApp, Sessione, Sorgente } from "./tipi";

const SORGENTE: Record<Sorgente, keyof ImpostazioniApp> = {
  "claude-code": "sorgenteClaudeCode", "claude-desktop": "sorgenteClaude", codex: "sorgenteCodex", cursor: "sorgenteCursor",
};
const GIORNI: Record<string, number> = { "7 giorni": 7, "30 giorni": 30, "90 giorni": 90 }; // «Per sempre» o altro = nessun limite
const GIORNO_MS = 86_400_000;

/** Valori salvati + valori di partenza per quelli mancanti. */
export const conPartenza = (salvate: Record<string, unknown>): ImpostazioniApp => ({ ...PARTENZA, ...(salvate as Partial<ImpostazioniApp>) });

/** Sessioni che le impostazioni lasciano vedere. Una sessione in corso o in attesa non esce mai per età. */
export function filtraElenco(elenco: Elenco, salvate: Record<string, unknown>, ora: number, home: string): Elenco {
  const i = conPartenza(salvate);
  const escluse = i.cartelleEscluse.map((c) => path.resolve(espandi(c, home)));
  const giorni = GIORNI[i.cronologia];
  const visibile = (s: Sessione) => {
    if (!i[SORGENTE[s.sorgente]]) return false;
    if (s.cartella) {
      const c = path.resolve(s.cartella);
      if (escluse.some((e) => c === e || c.startsWith(e + path.sep))) return false;
    }
    return !(giorni && s.stato !== "lavora" && s.stato !== "aspetta" && ora - s.ultimaAttivita > giorni * GIORNO_MS);
  };
  return { ...elenco, sessioni: elenco.sessioni.filter(visibile) };
}
