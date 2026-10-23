// figma: 101-12461 — «Segno stato»: icona e colore per ogni stato di una sessione.
import type { Stato } from "../../tipi";
import { Icona } from "./Icona";

export type StatoSegno = Stato | "errore";
const SEGNI = {
  lavora: ["in-corso", "secondaria"],
  aspetta: ["mano", "accento"],
  ferma: ["pausa", "terziaria"],
  finita: ["finita", "successo"],
  errore: ["avviso", "errore"],
} as const;

export function SegnoStato({ stato }: { stato: StatoSegno }) {
  const [nome, colore] = SEGNI[stato];
  return <Icona nome={nome} colore={colore} />;
}
