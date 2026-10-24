// figma: 101-22137 — dialoghi dell'app aperti da più punti (voci del menu del profilo e della barra, ⌘/, scena di prova): «aggiornamento», «scorciatoie», «rinomina» (101-22044), «novita» (119-57552).
// Un solo dialogo alla volta; li disegna `ui/dialoghi`, la cornice lo monta.
import { useSyncExternalStore } from "react";
import { avvisa } from "./Avvisi";
import { messaggioErrore } from "./dati";
import type { Novita } from "../../tipi";

/** Dati dei dialoghi che ne hanno: «rinomina» (sessione e etichetta di una cartella) e «novita». */
export interface DatiDialoghi {
  rinomina: { titolo: string; valore: string; nota: string; salva(nome: string): void };
  novita: { versione: string; novita: Novita };
  /** «Scegli le ore…» del silenzio (149-66688): `valore` «22:00–7:00»; `attivo` = [riga, segmento] col fuoco. */
  ore: { valore: string; attivo?: [number, number]; salva(ore: string): void };
}
export type NomeDialogo = "aggiornamento" | "scorciatoie" | keyof DatiDialoghi;
export interface Aperto { nome: NomeDialogo; dati?: unknown }

let aperto: Aperto | null = null;
const ascolta = new Set<() => void>();
const cambia = (a: Aperto | null) => { aperto = a; ascolta.forEach((f) => f()); };

export function apriDialogo(n: "aggiornamento" | "scorciatoie"): void;
export function apriDialogo<N extends keyof DatiDialoghi>(n: N, dati: DatiDialoghi[N]): void;
export function apriDialogo(n: NomeDialogo, dati?: unknown) { cambia({ nome: n, dati }); }
export const chiudiDialogo = () => cambia(null);
export const alternaDialogo = (n: "aggiornamento" | "scorciatoie") => cambia(aperto?.nome === n ? null : { nome: n });
export const useDialogo = () => useSyncExternalStore((f) => { ascolta.add(f); return () => { ascolta.delete(f); }; }, () => aperto);

/** «Novità» (menu del profilo, Info): apre le note della versione; se il main non ne ha, lo dice. */
export async function apriNovita() {
  try {
    const [novita, versione] = await Promise.all([window.impostazioni.novita(), window.impostazioni.versione()]);
    if (novita) return apriDialogo("novita", { versione, novita });
    avvisa({ tipo: "info", messaggio: `Nessuna novità per la versione ${versione}` });
  } catch (e) { avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }); }
}

/** «Controlla aggiornamenti»: se sul disco c'è una versione nuova apre «Aggiornare clotch ora?», se no lo dice. */
export async function verificaAggiornamenti() {
  try {
    if (await window.impostazioni.aggiornamenti(true)) return apriDialogo("aggiornamento");
    avvisa({ tipo: "info", messaggio: `Già aggiornato · versione ${await window.impostazioni.versione()}` });
  } catch (e) { avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }); }
}
