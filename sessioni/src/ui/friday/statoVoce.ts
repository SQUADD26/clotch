// figma: 101-36832 — stato della voce di clotch AI (101-36832 ti ascolta, 101-37055 sta parlando, 101-37278 microfono non disponibile).
// Puro: nessun file, nessun DOM. Viene tutto dal registro; l'app non apre mai il microfono da sé.
import type { Registro } from "../../friday";

/** Clotch: ultimo evento più vecchio di 10 minuti = spento (contratto v1, § 4; stessa soglia di `clotchAcceso` in src/friday.ts). */
const CLOTCH_SPENTO_MS = 600_000;

export type StatoVoce = "ascolta" | "parla" | "mic-no";

/**
 * `parlaApp`: l'app stessa sta dicendo un avviso (Clotch assente, `say` in corso).
 * Ascolta e parla vengono dall'evento `clotch`; «microfono non disponibile» dall'ultimo evento `impostazioni`
 * (`microfoni_disponibili` vuoto: clotch AI non ha un ingresso da ascoltare).
 */
export function statoVoce(r: Registro, ora: number, parlaApp = false): StatoVoce | null {
  const c = r.clotch;
  if (c && c.voce === "accesa" && ora - c.t <= CLOTCH_SPENTO_MS) {
    if (c.ascolta) return "ascolta";
    if (c.parla) return "parla";
  }
  if (parlaApp) return "parla";
  const mic = r.impostazioni?.microfoni_disponibili;
  return Array.isArray(mic) && mic.length === 0 ? "mic-no" : null;
}
