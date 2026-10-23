// figma: 101-22137 — dialoghi dell'app aperti da più punti (voci del menu del profilo, ⌘/, scena di prova): «aggiornamento» e «scorciatoie».
// Un solo dialogo alla volta; li disegna `ui/dialoghi`, la cornice lo monta.
import { useSyncExternalStore } from "react";
import { avvisa } from "./Avvisi";
import { messaggioErrore } from "./dati";

export type NomeDialogo = "aggiornamento" | "scorciatoie";

let aperto: NomeDialogo | null = null;
const ascolta = new Set<() => void>();
const cambia = (n: NomeDialogo | null) => { aperto = n; ascolta.forEach((f) => f()); };

export const apriDialogo = (n: NomeDialogo) => cambia(n);
export const chiudiDialogo = () => cambia(null);
export const alternaDialogo = (n: NomeDialogo) => cambia(aperto === n ? null : n);
export const useDialogo = () => useSyncExternalStore((f) => { ascolta.add(f); return () => { ascolta.delete(f); }; }, () => aperto);

/** «Verifica aggiornamenti…»: se sul disco c'è una versione nuova apre «Aggiornare clotch ora?», se no lo dice. */
export async function verificaAggiornamenti() {
  try {
    if (await window.impostazioni.aggiornamenti(true)) return apriDialogo("aggiornamento");
    avvisa({ tipo: "info", messaggio: `Già aggiornato · versione ${await window.impostazioni.versione()}` });
  } catch (e) { avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }); }
}
