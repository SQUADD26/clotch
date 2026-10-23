// figma: 101-46496 — pillola «Clotch collegato» (coppie CL2–CL10, intestazione della sessione); 101-49891 — pillola «schermo occupato» (CL9).
import { useSyncExternalStore } from "react";
import { Icona } from "../base/Icona";
import { clotchAcceso, suClotch } from "./clotch";
import "./pannello.css";

/** «Clotch acceso?» per i componenti React: si ridisegna a ogni cambio. */
export const useClotchAcceso = () => useSyncExternalStore(suClotch, clotchAcceso);

/** Si mostra solo con Clotch acceso: senza Clotch l'intestazione non ha la pillola. */
export function PillolaClotch() {
  return useClotchAcceso() ? <Clotch /> : null;
}

export function Clotch() {
  return (
    <span className="pillola-clotch" title="clotch collegato">
      <Icona nome="schermo" colore="successo" />
      clotch
    </span>
  );
}

/** `testo` dal registro, per esempio «Uno script usa lo schermo · 0:42». Senza Clotch l'app non lo sa: niente pillola. */
export function PillolaSchermoOccupato({ testo }: { testo: string }) {
  return useClotchAcceso() ? <SchermoOccupato testo={testo} /> : null;
}

export function SchermoOccupato({ testo }: { testo: string }) {
  return (
    <span className="pillola-clotch schermo">
      <Icona nome="finestra" />
      {testo}
    </span>
  );
}
