// figma: 101-37696 — «dialogo» con «velo» (anche 101-39512, 101-40699, 101-22095): titolo, corpo, bottoni a destra.
// Esc, ⌘. e clic sul velo chiudono, Tab resta dentro, il fuoco torna a chi lo aveva (base/Sovrapposto); il fuoco va al pezzo con data-fuoco, se no al primo campo, se no al bottone primario (Invio lo preme, HIG Alerts), se no al primo bottone: nelle conferme distruttive è «Annulla».
import { useEffect, useState, type ReactNode } from "react";
import { Icona } from "./Icona";
import { Velo } from "./Sovrapposto";
import "./dialogo.css";

/** `largo`: dialogo da 560 px (149:67536); `alto`: sotto il bordo invece che al centro (101-22186); `chiudi`: la X accanto al titolo; `centrato`: al centro esatto della finestra, senza lo scarto di 101-37696 (149:67536, 149:67760); `bottoni` assente: nessuna riga di bottoni (preparazione in corso, 149:67632). */
export function Dialogo({ titolo, corpo, bottoni, children, largo = false, alto = false, chiudi = false, centrato = false, onChiudi }: { titolo: string; corpo?: string; bottoni?: ReactNode; children?: ReactNode; largo?: boolean; alto?: boolean; chiudi?: boolean; centrato?: boolean; onChiudi(): void }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  // senza controlli (preparazione in corso) il fuoco sta sul dialogo, che tiene dentro il Tab
  useEffect(() => { (el?.querySelector<HTMLElement>("[data-fuoco]") ?? el?.querySelector<HTMLElement>("textarea, input") ?? el?.querySelector<HTMLElement>(".bottoni .primario") ?? el?.querySelector<HTMLElement>(".bottoni button, button") ?? el)?.focus(); }, [el]);
  return (
    <Velo className={alto ? "alto" : ""} centrato={centrato} onChiudi={onChiudi}>
      <div ref={setEl} className={`dialogo${largo ? " largo" : ""}`} role="dialog" aria-modal="true" tabIndex={-1} aria-label={titolo}>
        {chiudi
          ? <div className="testata-dialogo"><div className="t-lg medio">{titolo}</div><button type="button" className="chiudi" aria-label="Chiudi" onClick={onChiudi}><Icona nome="chiudi" /></button></div>
          : <div className="t-lg medio">{titolo}</div>}
        <div className="dialogo-corpo">
          {corpo && <div className="t-base secondario">{corpo}</div>}
          {children}
        </div>
        {bottoni && <div className="bottoni">{bottoni}</div>}
      </div>
    </Velo>
  );
}
