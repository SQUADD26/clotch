// figma: 101-37696 — «dialogo» con «velo» (anche 101-39512, 101-40699, 101-22095): titolo, corpo, bottoni a destra.
// Esc e clic sul velo chiudono; il fuoco va al pezzo con data-fuoco, se no al primo campo o bottone.
import { useEffect, useRef, type ReactNode } from "react";
import "./dialogo.css";

/** `largo`: dialogo da 560 px (149:67536); `centrato`: al centro esatto della finestra, senza lo scarto di 101-37696 (149:67536, 149:67760); `bottoni` assente: nessuna riga di bottoni (preparazione in corso, 149:67632). */
export function Dialogo({ titolo, corpo, bottoni, children, largo = false, centrato = false, onChiudi }: { titolo: string; corpo?: string; bottoni?: ReactNode; children?: ReactNode; largo?: boolean; centrato?: boolean; onChiudi(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (ref.current?.querySelector<HTMLElement>("[data-fuoco]") ?? ref.current?.querySelector<HTMLElement>("textarea, input, button"))?.focus();
    const tasto = (e: KeyboardEvent) => { if (e.key === "Escape") onChiudi(); };
    addEventListener("keydown", tasto);
    return () => removeEventListener("keydown", tasto);
  }, [onChiudi]);
  return (
    <div className={`velo${centrato ? " centrato" : ""}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onChiudi(); }}>
      <div ref={ref} className={`dialogo${largo ? " largo" : ""}`} role="dialog" aria-modal="true" aria-label={titolo}>
        <div className="t-lg medio">{titolo}</div>
        {corpo && <div className="t-base secondario">{corpo}</div>}
        {children}
        {bottoni && <div className="bottoni">{bottoni}</div>}
      </div>
    </div>
  );
}
