// figma: 101-30345 — «Avvio»: finché l'elenco delle sessioni non è arrivato, il logo al centro della finestra (barra del titolo sopra, corpo nascosto).
// Stati senza disegno (lento, uscita): seguono 101-9090 per il testo e il bottone, e il movimento dell'entrata del corpo.
import { useEffect, useState } from "react";
import { useStatoElenco } from "./dati";
import { Bottone } from "./Bottone";
import { Icona } from "./Icona";
import "./avvio.css";

const LENTO_MS = 8000;
let finito = false; // l'avvio vale solo per la prima risposta dopo l'apertura: un «Riprova» non lo riporta

/** Vero finché la prima risposta dell'elenco non è arrivata; un errore o un elenco vuoto la chiudono. */
export function useAvvio() {
  const e = useStatoElenco();
  if (e.stato !== "carica" || e.dati) finito = true;
  return !finito;
}

/** Il logo resta montato e si dissolve a fine avvio (movimento.css); dopo `LENTO_MS` dice che sta tardando e offre «Riprova». */
export function Avvio({ fine }: { fine: boolean }) {
  const { riprova } = useStatoElenco();
  const [lento, setLento] = useState(false);
  useEffect(() => {
    if (fine) { setLento(false); return; }
    const t = setTimeout(() => setLento(true), LENTO_MS);
    return () => clearTimeout(t);
  }, [fine]);
  return (
    <div className="avvio" data-fine={fine || undefined} role={fine ? undefined : "status"} aria-label={fine ? undefined : "clotch si sta aprendo"} aria-hidden={fine || undefined}>
      <span className="logo"><Icona nome="strati" colore="su-accento" /></span>
      {lento && !fine && (
        <div className="lento">
          <div className="t-base secondario">L’apertura sta durando più del solito.</div>
          <Bottone tipo="secondario" onClick={riprova}>Riprova</Bottone>
        </div>
      )}
    </div>
  );
}
