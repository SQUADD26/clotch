// figma: 101-36832 — «casella voce» (ti ascolta 101-36832, sta parlando 101-37055) e «avviso microfono» (101-37278).
// Ti ascolta e sta parlando arrivano da Clotch (evento `clotch` del registro); «Interrompi» ferma solo la voce dell'app.
import { useEffect, useState } from "react";
import { Bottone } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { useOra } from "../chat/friday";
import { friday, useRegistro } from "./dati";
import { AvvisoRosso } from "./Pezzi";
import { statoVoce, type StatoVoce } from "./statoVoce";
import "./voce.css";

/** L'app sta dicendo un avviso a voce (Clotch assente): lo dice il main, che è chi lancia `say`. */
function useVoceApp() {
  const [parla, setParla] = useState(false);
  useEffect(() => {
    friday().voce().then(setParla, () => {});
    return friday().onVoce(setParla);
  }, []);
  return parla;
}

export function useVoce() {
  const { dati: r } = useRegistro();
  const parlaApp = useVoceApp();
  const ora = useOra();
  return { stato: r ? statoVoce(r, ora, parlaApp) : null, parlaApp };
}

const BARRE = 8;

/** La barra al posto della casella: il testo non è il parlato (il registro non lo porta), dice cosa fare. */
export function BarraVoce({ stato, parlaApp }: { stato: Exclude<StatoVoce, "mic-no">; parlaApp: boolean }) {
  const ascolta = stato === "ascolta";
  return (
    <div className={`barra-voce ${stato}`} role="status">
      <Icona nome={ascolta ? "microfono" : "scintille"} colore={ascolta ? "accento" : "secondaria"} />
      <span className={`testo t-sm ${ascolta ? "primario" : "secondario"}`}>{ascolta ? "Parla pure. Per finire premi ⌥Spazio." : "clotch AI sta parlando"}</span>
      <span className="onda" aria-hidden>{Array.from({ length: BARRE }, (_, i) => <span key={i} className="barra" />)}</span>
      {/* Interrompi ferma `say` dell'app; la voce di Clotch non ha un comando nel contratto v1 */}
      {!ascolta && parlaApp && <Bottone tipo="secondario" onClick={() => void friday().interrompiVoce()}>Interrompi</Bottone>}
    </div>
  );
}

/** 101-37278: il testo è quello del disegno; la casella sotto resta attiva, si può scrivere. */
export const AvvisoMicrofono = () =>
  <AvvisoRosso titolo="Microfono non disponibile" corpo="Concedi l’accesso in Impostazioni di Sistema › Privacy › Microfono. Intanto puoi scrivere." />;
