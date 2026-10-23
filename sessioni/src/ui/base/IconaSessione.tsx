// figma: 101-11220 — «Icona sessione»: un'icona «Icona/*» nel colore della sessione (Colore=Grigio…Viola, colore/sessione/*).
import { useImpostazioni } from "../impostazioni/stato";
import { Glifo } from "./Icona";
import { icone, type NomeIcona } from "./icone";

export const COLORI_SESSIONE = ["grigio", "rosso", "arancione", "verde", "blu", "viola"] as const;
export type ColoreSessione = (typeof COLORI_SESSIONE)[number];

/** Valori sconosciuti (preferenze vecchie o scritte a mano) tornano alla stella grigia del componente. */
export function IconaSessione({ icona, colore }: { icona?: string; colore?: string }) {
  if (!useImpostazioni().iconeSessioni) return null; // impostazione «Icone delle sessioni»
  const nome = (icona && icona in icone ? icona : "stella") as NomeIcona;
  const c = COLORI_SESSIONE.includes(colore as ColoreSessione) ? (colore as ColoreSessione) : "grigio";
  return <Glifo nome={nome} colore={`colore-sessione-${c}`} />;
}
