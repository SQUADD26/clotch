// Bozze della finestra: identità della conversazione e, per la coda, della singola voce.
// Restano in memoria attraversando chat e impostazioni; nessun testo finisce su disco.
import { useSyncExternalStore } from "react";
import type { VoceCoda } from "./Casella";

interface Testo { testo: string }
interface Stato { testo: string; modifica: VoceCoda | null; invio: boolean }

function nuova(testo: string, modifica: VoceCoda | null) {
  const voci = new Map<string | null, Testo>([[modifica?.voce ?? null, { testo }]]);
  let attiva = modifica?.voce ?? null;
  let invio = false;
  let stato: Stato;
  const ascoltatori = new Set<() => void>();
  const aggiorna = () => {
    const testo = voci.get(attiva)?.testo ?? "";
    stato = { testo, modifica: attiva === null ? null : { voce: attiva, testo }, invio };
    ascoltatori.forEach((f) => f());
  };
  aggiorna();
  return {
    leggi: () => stato,
    ascolta: (f: () => void) => { ascoltatori.add(f); return () => { ascoltatori.delete(f); }; },
    scrivi: (testo: string) => { voci.set(attiva, { testo }); aggiorna(); },
    modifica: (voce: VoceCoda) => {
      if (!voci.has(voce.voce)) voci.set(voce.voce, { testo: voce.testo });
      attiva = voce.voce;
      aggiorna();
    },
    // `tieni`: il testo della voce passa alla bozza nuova (la voce non c'è più)
    esci: (tieni = false) => { if (tieni) voci.set(null, { testo: stato.testo }); attiva = null; aggiorna(); },
    // `conAllegati`: un messaggio con solo file o immagini, senza testo, parte lo stesso
    inizia: (conAllegati = false) => {
      if (invio || (!stato.testo.trim() && !conAllegati)) return null;
      const chiave = attiva, bozza = voci.get(chiave);
      const richiesta = { ...stato };
      invio = true;
      aggiorna();
      return {
        ...richiesta,
        finisci: (ok: boolean) => {
          invio = false;
          // Una risposta tardiva può cancellare solo la precisa bozza partita.
          if (ok && voci.get(chiave) === bozza) {
            voci.delete(chiave);
            if (attiva === chiave) attiva = null;
          }
          aggiorna();
        },
      };
    },
  };
}

const bozze = new Map<string, ReturnType<typeof nuova>>();

export function useBozza(chat: string, testo: string, modifica: VoceCoda | null) {
  if (!bozze.has(chat)) bozze.set(chat, nuova(testo, modifica));
  const bozza = bozze.get(chat)!;
  return { ...useSyncExternalStore(bozza.ascolta, bozza.leggi), bozza };
}
