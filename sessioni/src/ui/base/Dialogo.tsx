// figma: 101-37696 — «dialogo» con «velo» (anche 101-39512, 101-40699, 101-22095): titolo, corpo, bottoni a destra.
// Esc e clic sul velo chiudono; il fuoco va al primo bottone (o al campo nei children).
import { useEffect, useRef, type ReactNode } from "react";
import "./dialogo.css";

export function Dialogo({ titolo, corpo, bottoni, children, onChiudi }: { titolo: string; corpo?: string; bottoni: ReactNode; children?: ReactNode; onChiudi(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("textarea, input, button")?.focus();
    const tasto = (e: KeyboardEvent) => { if (e.key === "Escape") onChiudi(); };
    addEventListener("keydown", tasto);
    return () => removeEventListener("keydown", tasto);
  }, [onChiudi]);
  return (
    <div className="velo" onMouseDown={(e) => { if (e.target === e.currentTarget) onChiudi(); }}>
      <div ref={ref} className="dialogo" role="dialog" aria-modal="true" aria-label={titolo}>
        <div className="t-lg medio">{titolo}</div>
        {corpo && <div className="t-base secondario">{corpo}</div>}
        {children}
        <div className="bottoni">{bottoni}</div>
      </div>
    </div>
  );
}
