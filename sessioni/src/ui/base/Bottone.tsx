// figma: 101-12461 — «Bottone» (Primario, Secondario), «Bottone icona» (Riposo, Passaggio), «Filtro» come pillola.
import type { ButtonHTMLAttributes } from "react";
import { Icona, type NomeIcona } from "./Icona";
import "./componenti.css";

type Base = ButtonHTMLAttributes<HTMLButtonElement>;

/** `pericolo`: «Bottone pericolo» di 101-37696 (Ferma tutto, Annulla la decisione). `piccolo`: alto `bottone` (barra del titolo, 101-37879). */
export function Bottone({ tipo = "primario", piccolo = false, className = "", ...p }: Base & { tipo?: "primario" | "secondario" | "pericolo"; piccolo?: boolean }) {
  return <button type="button" {...p} className={`bottone ${tipo} ${piccolo ? "piccolo" : ""} ${className}`} />;
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
