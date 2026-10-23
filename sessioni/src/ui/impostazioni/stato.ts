// Impostazioni dell'app nel renderer (#351): partono dai valori dei frame Figma; si leggono e si scrivono nel file delle
// preferenze (#368, `api().impostazioni()`). Schema dal vault (rete-e-api.md § «Dal vivo», esperienza-uso.md § «Stati»):
// nessun nuovo tentativo qui; il cambio si vede subito e, se il main non salva, torna com'era con un avviso «Riprova».
import { useSyncExternalStore } from "react";
import type { ImpostazioniApi, ImpostazioniApp } from "../../tipi";
import { avvisa } from "../base/Avvisi";
import { PARTENZA } from "../../partenza";
import { api, messaggioErrore } from "../base/dati";

declare global {
  interface Window { impostazioni: ImpostazioniApi }
}

export { PARTENZA };
/** Valore di `apriSessione` che apre le sessioni in una finestra a parte. */
export const IN_NUOVA_FINESTRA = "In una nuova finestra";
export type Impostazioni = ImpostazioniApp;
export type Chiave = keyof Impostazioni;

let valori: Impostazioni = PARTENZA;
const ascolta = new Set<() => void>();
const cambia = (v: Impostazioni) => { valori = v; ascolta.forEach((f) => f()); };
// le scorciatoie si uniscono una per una: un file salvato prima di una scorciatoia nuova (trova) non la perde
const daFile = (salvate: Record<string, unknown>) => cambia({ ...PARTENZA, ...(salvate as Partial<Impostazioni>), scorciatoie: { ...PARTENZA.scorciatoie, ...(salvate.scorciatoie as Impostazioni["scorciatoie"] | undefined) } });
let avviato = false;

/** Legge il file una volta e lo segue dal vivo (anche nella prova: lì risponde la scena). */
export function caricaImpostazioni() {
  if (!avviato) { avviato = true; api().onImpostazioni(daFile); }
  api().impostazioni().then(daFile,
    (e) => avvisa({ tipo: "errore", messaggio: messaggioErrore(e), azione: { etichetta: "Riprova", fai: caricaImpostazioni } }));
}

export function imposta<K extends Chiave>(chiave: K, valore: Impostazioni[K]) {
  const prima = valori[chiave];
  cambia({ ...valori, [chiave]: valore });
  const salva = api().impostaImpostazioni({ [chiave]: valore });
  (chiave === "apriAllAvvio" ? salva.then(() => window.impostazioni.avvio(valore === true)) : salva).catch((e) => {
    if (valori[chiave] === valore) cambia({ ...valori, [chiave]: prima });
    avvisa({ tipo: "errore", messaggio: messaggioErrore(e), azione: { etichetta: "Riprova", fai: () => imposta(chiave, valore) } });
  });
}

/** Tutte le impostazioni; si aggiorna a ogni cambio. Le usano anche gli altri pezzi (tema, scorciatoie, sorgenti). */
export function useImpostazioni(): Impostazioni {
  return useSyncExternalStore((f) => { ascolta.add(f); return () => ascolta.delete(f); }, () => valori);
}
