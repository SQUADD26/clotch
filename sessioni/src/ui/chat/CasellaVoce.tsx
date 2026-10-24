// figma: 101-46268 — «Casella voce» 101:36641 (Parla, Ascolto) al posto della casella di scrittura, e «nota clotch» sopra quando ascolta.
// Parla: clotch AI parla dal notch (Clotch) o sta parlando (l'app); «Interrompi». Ascolto: il testo dettato finora; «Fine».
import { useEffect, useRef } from "react";
import { Bottone } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { Pezzo } from "../base/Pezzo";
import { annullaDettatura, dettatura, fineDettatura, fineDettaturaClotch, interrompiVoce, type Voce } from "../clotch-ai/dettatura";
import { useAvvisiSopra } from "./avvisiSopra";
import "./casella.css";
import "./voce.css";

// Le otto barre dell'onda come nel disegno (101:36630): altezze in punti, senza variabile in Figma.
const ALTEZZE = [6, 12, 18, 10, 14, 8, 16, 6];

export function CasellaVoce({ voce }: { voce: NonNullable<Voce> }) {
  const testo = dettatura.usa().testo;
  const ascolta = voce.cosa === "ascolta", clotch = voce.chi === "clotch";
  const area = useRef<HTMLDivElement>(null);
  useAvvisiSopra(area);
  const riga = useRef<HTMLSpanElement>(null);
  const annullabile = ascolta && !clotch; // con Clotch il microfono lo chiude solo la sua pressione di ⌥Spazio
  // chi detta con la tastiera trova il fuoco su «Fine»; alla chiusura torna a «Detta» (se il testo non è finito nella casella)
  useEffect(() => {
    if (ascolta) area.current?.querySelector<HTMLElement>(".casella-voce > button:last-child")?.focus(); // «Fine»
    return () => void requestAnimationFrame(() => {
      if (document.activeElement === document.body) document.querySelector<HTMLElement>('[aria-label="Detta"]:not(:disabled)')?.focus();
    });
  }, [ascolta]);
  useEffect(() => {
    if (!annullabile) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); annullaDettatura(); } };
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [annullabile]);
  // il testo lungo mostra la coda: le ultime parole sono quelle che servono
  useEffect(() => { const r = riga.current; if (r) r.scrollLeft = r.scrollWidth; }, [testo]);
  return (
    <Pezzo nome="chat"><div className="area-casella" ref={area}>
      {ascolta && (
        <div className="nota-voce-casella">
          <Icona nome="microfono" />
          <span>Ti ascolta il microfono {clotch ? "di clotch" : "del Mac"} · ⌥Spazio</span>
        </div>
      )}
      <div className={`casella-voce ${voce.cosa}`} >
        <span className="solo-lettore" role="status">{ascolta ? "Dettatura aperta" : ""}</span>
        <Icona nome={ascolta ? "microfono" : "scintille"} colore={ascolta ? "accento" : "secondaria"} />
        <span className="testo" ref={riga}>{ascolta ? testo || "In ascolto…" : clotch ? "clotch AI parla dal notch" : "clotch AI sta parlando"}</span>
        <span className={`onda ${voce.cosa}`} aria-hidden>{ALTEZZE.map((h, i) => <span key={i} className="barra" style={{ "--h": `${h}px`, "--i": i } as React.CSSProperties} />)}</span>
        {annullabile && <Bottone tipo="secondario" onClick={annullaDettatura}>Annulla</Bottone>}
        <Bottone tipo="secondario" onClick={() => void (ascolta ? (clotch ? fineDettaturaClotch() : fineDettatura()) : interrompiVoce(voce.chi))}>
          {ascolta ? "Fine" : "Interrompi"}
        </Bottone>
      </div>
    </div></Pezzo>
  );
}

/** In cima al filo di una sessione che lavora, senza Clotch (101-49632): l'app non può sapere quando uno script prende lo schermo. */
export function NotaSchermo() {
  return (
    <div className="nota-schermo">
      <Icona nome="info" />
      <span>Senza clotch l’app non vede quando uno script usa lo schermo</span>
    </div>
  );
}
