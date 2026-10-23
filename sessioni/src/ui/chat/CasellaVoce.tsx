// figma: 101-46268 — «Casella voce» 101:36641 (Parla, Ascolto) al posto della casella di scrittura, e «nota clotch» sopra quando ascolta.
// Parla: clotch AI parla dal notch (Clotch) o sta parlando (l'app); «Interrompi». Ascolto: il testo dettato finora; «Fine».
import { useRef } from "react";
import { Bottone } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { Pezzo } from "../base/Pezzo";
import { dettatura, fineDettatura, fineDettaturaClotch, interrompiVoce, type Voce } from "../clotch-ai/dettatura";
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
  return (
    <Pezzo nome="chat"><div className="area-casella" ref={area}>
      {ascolta && (
        <div className="nota-voce-casella">
          <Icona nome="microfono" />
          <span>Ti ascolta il microfono {clotch ? "di Clotch" : "del Mac"} · ⌥Spazio</span>
        </div>
      )}
      <div className={`casella-voce ${voce.cosa}`} role="status">
        <Icona nome={ascolta ? "microfono" : "scintille"} colore={ascolta ? "accento" : "secondaria"} />
        <span className="testo">{ascolta ? testo || "Parla…" : clotch ? "clotch AI parla dal notch" : "clotch AI sta parlando"}</span>
        <span className="onda" aria-hidden>{ALTEZZE.map((h, i) => <span key={i} className="barra" style={{ height: h }} />)}</span>
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
      <span>Senza Clotch l’app non vede quando uno script usa lo schermo</span>
    </div>
  );
}
