// figma: 101-37696 — «dialogo» con «velo» (anche 101-39512, 101-40699, 101-22095): titolo, corpo, bottoni a destra.
// Esc e clic sul velo chiudono, Tab resta dentro, il fuoco torna a chi lo aveva (base/Sovrapposto); il fuoco va al pezzo con data-fuoco, se no al primo campo o bottone.
import { useEffect, useState, type ReactNode } from "react";
import { Velo } from "./Sovrapposto";
import "./dialogo.css";

/** `largo`: dialogo da 560 px (149:67536); `centrato`: al centro esatto della finestra, senza lo scarto di 101-37696 (149:67536, 149:67760); `bottoni` assente: nessuna riga di bottoni (preparazione in corso, 149:67632). */
export function Dialogo({ titolo, corpo, bottoni, children, largo = false, centrato = false, onChiudi }: { titolo: string; corpo?: string; bottoni?: ReactNode; children?: ReactNode; largo?: boolean; centrato?: boolean; onChiudi(): void }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => { (el?.querySelector<HTMLElement>("[data-fuoco]") ?? el?.querySelector<HTMLElement>("textarea, input, button"))?.focus(); }, [el]);
  return (
    <Velo centrato={centrato} onChiudi={onChiudi}>
      <div ref={setEl} className={`dialogo${largo ? " largo" : ""}`} role="dialog" aria-modal="true" aria-label={titolo}>
        <div className="t-lg medio">{titolo}</div>
        {corpo && <div className="t-base secondario">{corpo}</div>}
        {children}
        {bottoni && <div className="bottoni">{bottoni}</div>}
      </div>
    </Velo>
  );
}
