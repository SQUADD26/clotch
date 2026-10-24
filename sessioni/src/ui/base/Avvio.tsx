// figma: 101-30345 — «Avvio»: finché l'elenco delle sessioni non è arrivato, il logo al centro della finestra (barra del titolo sopra, corpo nascosto).
import { useElenco } from "./dati";
import { Icona } from "./Icona";
import "./avvio.css";

/** Vero finché la prima risposta dell'elenco non è arrivata; un errore o un elenco vuoto la chiudono. */
export function useAvvio() {
  const e = useElenco();
  return e.stato === "carica" && !e.dati;
}

export function Avvio() {
  return (
    <div className="avvio" role="status" aria-label="clotch si sta aprendo">
      <span className="logo"><Icona nome="strati" colore="su-accento" /></span>
    </div>
  );
}
