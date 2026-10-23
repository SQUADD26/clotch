// figma: 101-36225 — pezzi comuni delle viste clotch AI: «Avviso» rosso (101-36225, «avviso clotch AI» 101-42000) e «vuoto» (101-35803, 40267, 41628).
import type { ReactNode } from "react";
import { Icona, type NomeIcona } from "../base/Icona";

export function AvvisoRosso({ titolo, corpo }: { titolo: string; corpo: string }) {
  return (
    <div className="avviso-f" role="alert">
      <Icona nome="avviso" colore="errore" />
      <div className="testi">
        <span className="t-base medio">{titolo}</span>
        <span className="t-sm secondario">{corpo}</span>
      </div>
    </div>
  );
}

export function Vuoto({ icona, titolo, corpo, children }: { icona: NomeIcona; titolo: string; corpo: string; children?: ReactNode }) {
  return (
    <div className="vuoto-f">
      <Icona nome={icona} colore="terziaria" />
      <span className="t-base medio">{titolo}</span>
      <span className="t-sm secondario">{corpo}</span>
      {children}
    </div>
  );
}
