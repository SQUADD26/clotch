// figma: 101-34605 — «indicatore PR» sulla riga di una sessione: icona di stato (aperta verde, unita viola, chiusa rossa) e numero.
import type { PrSessione } from "../../tipi";
import { Icona } from "../base/Icona";

export const ICONA_PR = { aperta: ["pr-aperta", "successo"], unita: ["pr-unita", "viola"], chiusa: ["pr-chiusa", "errore"] } as const;

export function IndicatorePr({ pr }: { pr: PrSessione }) {
  const [icona, colore] = ICONA_PR[pr.stato];
  return (
    <span className="indicatore-pr" title={`PR #${pr.numero}`}>
      <Icona nome={icona} colore={colore} />
      <span className="t-xs secondario">{pr.numero}</span>
    </span>
  );
}
