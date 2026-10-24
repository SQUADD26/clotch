// figma: 101-45956 — Impostazioni · Clotch con Clotch collegato; senza Clotch: 101-45993.
// La versione arriva dall'evento clotch del registro (#339); finché Clotch non la scrive (#344) la descrizione la salta.
import { useEffect, useState } from "react";
import { Bottone } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { daPiano } from "../clotch-ai/registro";
import { useClotchAcceso } from "../pannello/Pillole";
import { Gruppo, Interruttore, Pagina, Riga } from "./controlli";
import { imposta, useImpostazioni, type Chiave } from "./stato";

const VOCI: [Chiave, string, string][] = [
  ["clotchVoce", "Voce dal notch", "clotch AI parla da clotch; qui vedi l’indicatore"],
  ["clotchDettatura", "Dettatura dal notch", "⌥Spazio apre il microfono di clotch"],
  ["clotchAvvisi", "Avvisi nel notch", "Gli avvisi compaiono sotto il notch"],
  ["clotchObiettivi", "Obiettivi anche nel notch", "Accetta e rifiuta dal notch o da qui"],
];

/** Dove si scarica Clotch: il main apre i collegamenti web nel browser (link-esterni.ts). */
const SCARICA = "https://github.com/SQUADD26/clotch/releases/latest";

function useVersioneClotch(): string | null {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => {
    const prendi = (p: unknown) => setV(daPiano(p).clotch?.versione ?? null);
    window.clotchAi.registro().then(prendi, () => {});
    return window.clotchAi.onRegistro(prendi);
  }, []);
  return v;
}

export default function Clotch() {
  const acceso = useClotchAcceso();
  const versione = useVersioneClotch();
  const v = useImpostazioni();
  return (
    <Pagina titolo="clotch">
      <Gruppo>
        <div className="riga stato-clotch">
          <Icona nome="schermo" colore={acceso ? "successo" : "terziaria"} />
          <div className="testi">
            <div className="t-base medio">{acceso ? "clotch è collegato" : "clotch non è installato"}</div>
            <div className="t-sm secondario">
              {acceso
                ? `${versione ? `Versione ${versione} · v` : "V"}oce, dettatura e avvisi passano dal notch`
                : "clotch fa tutto da sola: voce, dettatura e avvisi stanno qui"}
            </div>
          </div>
          {!acceso && <Bottone tipo="secondario" onClick={() => window.open(SCARICA)}>Scarica clotch</Bottone>}
        </div>
        {acceso && VOCI.map(([chiave, etichetta, descrizione]) => (
          <Riga key={chiave} etichetta={etichetta} descrizione={descrizione}>
            <Interruttore etichetta={etichetta} acceso={v[chiave] as boolean} onCambia={(x) => imposta(chiave, x)} />
          </Riga>
        ))}
      </Gruppo>
    </Pagina>
  );
}
