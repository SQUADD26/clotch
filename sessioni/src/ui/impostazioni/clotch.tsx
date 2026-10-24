// figma: 101-45956 — Impostazioni · Clotch con Clotch collegato; senza Clotch: 101-45993.
// La versione arriva dall'evento clotch del registro (#339); finché Clotch non la scrive (#344) la descrizione la salta.

import { useRegistro } from "../clotch-ai/dati";
import { Bottone } from "../base/Bottone";
import { Icona } from "../base/Icona";
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

const useVersioneClotch = (): string | null => useRegistro().dati?.clotch?.versione ?? null;

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
            <div className="t-base medio">{acceso ? "clotch è collegato" : "clotch non è collegato"}</div>
            <div className="t-sm secondario">
              {acceso
                ? `${versione ? `Versione ${versione}. V` : "V"}oce, dettatura e avvisi passano dal notch`
                : "clotch è l’app del notch: ti parla, ti ascolta e ti avvisa. Senza, tutto il resto funziona lo stesso"}
            </div>
          </div>
          {!acceso && <Bottone tipo="secondario" onClick={() => window.open(SCARICA)}>Ottieni clotch</Bottone>}
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
