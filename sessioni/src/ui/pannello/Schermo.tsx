// figma: 101-49592 — pillola «Uno script usa lo schermo · 0:42» al centro della barra del titolo (con Clotch; senza, la nota 101-49632 sta nella chat).
// Il main legge `schermo_in_arrivo` / `schermo_libero` da eventi.jsonl (stato-app.ts) e lo manda dentro il registro.
import { useOra } from "../chat/clotch-ai";
import { useRegistro } from "../clotch-ai/dati";
import { PillolaSchermoOccupato } from "./Pillole";

/** Come SCHERMO_SCADUTO_MS di stato-app.ts, che usa node:fs e non entra nel renderer: uno script senza «libero» smette di contare. */
const SCADUTO_MS = 60_000;

export const minutiSecondi = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export function CentroTitolo() {
  const da = useRegistro().dati?.schermo?.da;
  const ora = useOra(1000);
  if (da == null || ora - da >= SCADUTO_MS) return null;
  return <PillolaSchermoOccupato testo={`Uno script usa lo schermo · ${minutiSecondi(ora - da)}`} />;
}
