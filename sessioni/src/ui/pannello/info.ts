// figma: 101-33775 — dati del pannello «Info sessione»: contesto e file toccati dal main, formati come nel disegno («345,5k / 1M», «35%»).
import type { InfoSessione, PrSessione } from "../../tipi";
import { api, useAggiornamenti, useChiamata } from "../base/dati";

/** Numeri della trascrizione per la sessione aperta; null finché il main non risponde. Si rifà quando la sessione cambia. */
export function useInfo(id: string): InfoSessione | null {
  const c = useChiamata<InfoSessione>(() => api().info(id), [id]);
  useAggiornamenti((a) => { if (a.sessioni.includes(id)) c.ricarica(); });
  return c.dati ?? null;
}

// shortcut: finestra del contesto fissa a 1M (i modelli 5.x con più di 200k di token nelle sessioni vere); il file non dice la finestra, si cambia se arrivano modelli con un'altra.
export const FINESTRA_CONTESTO = 1_000_000;

const num = (n: number, dec = 1) => n.toLocaleString("it-IT", { maximumFractionDigits: dec });

/** 258000 -> «258k», 345500 -> «345,5k», 1000000 -> «1M». */
export function token(n: number): string {
  if (n >= 1_000_000) return `${num(n / 1_000_000)}M`;
  if (n >= 1000) return `${num(n / 1000)}k`;
  return String(n);
}

/** Percentuale col numero di decimali scelto: 0,258 -> «25,8%». */
export const percento = (parte: number, dec = 1) => `${num(parte * 100, dec)}%`;

/** «PR #336 · aperta verso dev», «PR #334 · unita in dev». */
export const testoPr = (p: PrSessione) =>
  `PR #${p.numero} · ${p.stato === "aperta" ? `aperta verso ${p.verso ?? "il ramo di base"}` : p.stato === "unita" ? `unita${p.verso ? ` in ${p.verso}` : ""}` : "chiusa senza unire"}`;
