// figma: 101-12461 — «Campo ricerca» (grande, nel dialogo) e «campo cerca» del menu filtro 101-16689 (piccolo).
import type { InputHTMLAttributes } from "react";
import { Icona, type NomeIcona } from "./Icona";
import "./componenti.css";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  grande?: boolean;
  icona?: NomeIcona;
  /** Tasto scritto a destra (solo grande), es. «esc». */
  tasto?: string;
}

export function Campo({ grande = false, icona = "cerca", tasto, className = "", ...p }: Props) {
  return (
    <label className={`campo ${grande ? "grande" : "piccolo"} ${className}`}>
      <Icona nome={icona} colore={grande ? "secondaria" : "terziaria"} />
      <input {...p} />
      {grande && tasto && <span className="tasto">{tasto}</span>}
    </label>
  );
}
