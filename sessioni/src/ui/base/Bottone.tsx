// figma: 101-12461 — «Bottone» (Primario, Secondario), «Bottone icona» (Riposo, Passaggio), «Filtro» come pillola.
import type { ButtonHTMLAttributes } from "react";
import { Icona, type NomeIcona } from "./Icona";
import "./componenti.css";

type Base = ButtonHTMLAttributes<HTMLButtonElement>;

export function Bottone({ tipo = "primario", className = "", ...p }: Base & { tipo?: "primario" | "secondario" }) {
  return <button type="button" {...p} className={`bottone ${tipo} ${className}`} />;
}

/** `etichetta` è il nome letto dai lettori di schermo e il suggerimento al passaggio. */
export function BottoneIcona({ icona, etichetta, className = "", ...p }: Base & { icona: NomeIcona; etichetta: string }) {
  return (
    <button type="button" aria-label={etichetta} title={etichetta} {...p} className={`bottone-icona ${className}`}>
      <Icona nome={icona} />
    </button>
  );
}

export function Pillola({ attiva = false, className = "", ...p }: Base & { attiva?: boolean }) {
  return <button type="button" aria-pressed={attiva} {...p} className={`pillola ${attiva ? "attiva" : ""} ${className}`} />;
}
