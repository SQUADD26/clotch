// figma: 101-49592 — pillola «Uno script usa lo schermo · 0:42» al centro della barra del titolo (con Clotch; senza, la nota 101-49632 sta nella chat).
// Il main legge `schermo_in_arrivo` / `schermo_libero` da eventi.jsonl (stato-app.ts) e lo manda dentro il registro.
import { useSyncExternalStore } from "react";
import { numero } from "../base/token";
import { useOra } from "../chat/clotch-ai";
import { useRegistro } from "../clotch-ai/dati";
import { PillolaSchermoOccupato } from "./Pillole";

/** Come SCHERMO_SCADUTO_MS di stato-app.ts, che usa node:fs e non entra nel renderer: uno script senza «libero» smette di contare. */
const SCADUTO_MS = 60_000;

export const minutiSecondi = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/** Sotto la larghezza di una colonna al centro della barra non resta posto: la pillola coprirebbe i bottoni (101-29971, 101-29770). */
const largaAbbastanza = () => {
  const q = matchMedia(`(min-width: ${numero("misura-colonna")}px)`);
  return { su: (f: () => void) => { q.addEventListener("change", f); return () => q.removeEventListener("change", f); }, ora: () => q.matches };
};
const finestraLarga = largaAbbastanza();

export function CentroTitolo() {
  const larga = useSyncExternalStore(finestraLarga.su, finestraLarga.ora);
  const da = useRegistro().dati?.schermo?.da;
  return da == null || !larga ? null : <Contatore da={da} />; // il secondo che scorre solo quando c'è uno script: niente render al secondo a vuoto (issue 474)
}

function Contatore({ da }: { da: number }) {
  const ora = useOra(1000);
  if (ora - da >= SCADUTO_MS) return null;
  return <PillolaSchermoOccupato testo={`Uno script usa lo schermo · ${minutiSecondi(ora - da)}`} />;
}
