// figma: 101-37278 — «avviso microfono»; lo stato della voce (ti ascolta, sta parlando) per la riga di stato in alto. La casella voce è `chat/CasellaVoce`.
import { useEffect, useState } from "react";
import { useOra } from "../chat/clotch-ai";
import { clotchAi, useRegistro } from "./dati";
import { AvvisoRosso } from "./Pezzi";
import { statoVoce } from "./statoVoce";
import "./voce.css";

/** L'app sta dicendo un avviso a voce (Clotch assente): lo dice il main, che è chi lancia `say`. */
export function useVoceApp() {
  const [parla, setParla] = useState(false);
  useEffect(() => {
    clotchAi().voce().then(setParla, () => {});
    return clotchAi().onVoce(setParla);
  }, []);
  return parla;
}

export function useVoce() {
  const { dati: r } = useRegistro();
  const parlaApp = useVoceApp();
  const ora = useOra();
  return { stato: r ? statoVoce(r, ora, parlaApp) : null, parlaApp };
}

/** 101-37278: il testo è quello del disegno; la casella sotto resta attiva, si può scrivere. */
export const AvvisoMicrofono = () =>
  <AvvisoRosso titolo="Microfono non disponibile" corpo="Concedi l’accesso in Impostazioni di Sistema › Privacy › Microfono. Intanto puoi scrivere." />;
