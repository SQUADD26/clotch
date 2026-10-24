// figma: 101-30345 — «Avvio»: finché l'elenco delle sessioni non è arrivato, il logo al centro della finestra (barra del titolo sopra, corpo nascosto).
// Stati senza disegno (lento, uscita): seguono 101-9090 per il testo e il bottone, e il movimento dell'entrata del corpo.
import { useSyncExternalStore } from "react";
import { useStatoElenco } from "./dati";
import { Bottone } from "./Bottone";
import { Icona } from "./Icona";
import { useNavigazione } from "./navigazione";
import "./avvio.css";

const LENTO_MS = 8000;
let finito = false; // l'avvio vale solo per la prima risposta dopo l'apertura: un «Riprova» non lo riporta

// Dopo LENTO_MS di avvio l'app dice che sta tardando e lascia aprire Impostazioni (via d'uscita: cartella lenta o bloccata, #901).
let lento = false;
const chi = new Set<() => void>();
setTimeout(() => { if (!finito) { lento = true; chi.forEach((f) => f()); } }, LENTO_MS);
export const useAvvioLento = () => useSyncExternalStore((f) => { chi.add(f); return () => { chi.delete(f); }; }, () => lento && !finito);

/** Vero finché la prima risposta dell'elenco non è arrivata; un errore o un elenco vuoto la chiudono. */
export function useAvvio() {
  const e = useStatoElenco();
  if (e.stato !== "carica" || e.dati) finito = true;
  return !finito;
}

/** L'avvio copre la finestra: come `useAvvio`, ma nello stato lento la vista Impostazioni si vede e si usa. */
export function useCoperto() {
  const avvio = useAvvio(), sta = useAvvioLento(), { vista } = useNavigazione();
  return avvio && !(sta && vista === "impostazioni");
}

/** Il logo resta montato e si dissolve a fine avvio (movimento.css); dopo `LENTO_MS` dice che sta tardando e offre «Riprova». */
export function Avvio({ fine }: { fine: boolean }) {
  const { riprova } = useStatoElenco();
  const { apri } = useNavigazione();
  const sta = useAvvioLento();
  return (
    <div className="avvio" data-fine={fine || undefined} role={fine ? undefined : "status"} aria-label={fine ? undefined : "clotch si sta aprendo"} aria-hidden={fine || undefined}>
      <span className="logo"><Icona nome="strati" colore="su-accento" /></span>
      {sta && !fine && (
        <div className="lento">
          <div className="t-base secondario">L’apertura sta durando più del solito.</div>
          <div className="bottoni">
            <Bottone onClick={() => apri("impostazioni")}>Apri impostazioni</Bottone>
            <Bottone tipo="secondario" onClick={riprova}>Riprova</Bottone>
          </div>
        </div>
      )}
    </div>
  );
}
