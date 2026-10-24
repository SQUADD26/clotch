// figma: 101-12461 — «Bottone» (Primario, Secondario), «Bottone icona» (Riposo, Passaggio), «Filtro» come pillola.
import type { ButtonHTMLAttributes } from "react";
import { Glifo, Icona, type NomeIcona } from "./Icona";
import "./componenti.css";

type Base = ButtonHTMLAttributes<HTMLButtonElement>;

/** `pericolo`: «Bottone pericolo» di 101-37696 (Ferma tutto, Annulla la decisione). `piccolo`: alto `bottone` (barra del titolo, 101-37879). */
const SPINNER = { primario: "colore-testo-su-primario", secondario: "colore-icona-secondaria", pericolo: "colore-testo-errore" } as const;

/** `caricamento` (158:82182…): spinner prima dell'etichetta, il bottone non si può premere. */
export function Bottone({ tipo = "primario", piccolo = false, caricamento = false, className = "", children, ...p }: Base & { tipo?: "primario" | "secondario" | "pericolo"; piccolo?: boolean; caricamento?: boolean }) {
  return (
    <button type="button" {...p} disabled={p.disabled || caricamento} aria-busy={caricamento || undefined} className={`bottone ${tipo} ${piccolo ? "piccolo" : ""} ${caricamento ? "caricamento" : ""} ${className}`}>
      {caricamento && <Glifo nome="spinner" colore={SPINNER[tipo]} gira />}
      {children}
    </button>
  );
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
