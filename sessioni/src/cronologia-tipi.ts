// Snapshot e aggiornamenti della cronologia: solo dati serializzabili attraverso IPC.
import type { Messaggio } from "./tipi";

export interface OpzioniCronologia {
  v: 1;
  /** Assente: nuova snapshot; presente: pagina precedente della stessa snapshot. */
  cursore?: string;
}

export interface RigaCronologia {
  /** Epoca del file, byte iniziale della riga di nascita, indice di emissione. */
  chiave: string;
  /** Posizione di nascita nella sorgente; resta stabile durante gli aggiornamenti. */
  ordine: number;
  /** Sequenza del commit che ha prodotto questo valore. */
  revisione: number;
  messaggio: Messaggio;
}

export interface SnapshotPagina {
  v: 1;
  sessione: string;
  epoca: string;
  /** Token opaco del coordinatore; tutte le sue pagine sono immutabili. */
  snapshot: string;
  /** Sequenza del commit inclusa nella snapshot, uguale per tutte le sue pagine. */
  watermark: number;
  cursorePrima: string | null;
  righe: RigaCronologia[];
  totaleSnapshot: number;
}

export interface ErroreCronologia {
  codice: "non_letta" | "sorgente_assente" | "cursore_invalido" |
    "snapshot_scaduta" | "epoca_cambiata" | "sorgente_instabile";
  testo: string;
  ripartenza: "stessa_pagina" | "nuova_snapshot";
}

export type DeltaCronologia =
  | { tipo: "upsert"; sessione: string; epoca: string;
      daSeq: number; aSeq: number; righe: RigaCronologia[]; totale: number }
  | { tipo: "reset"; sessione: string; epocaPrecedente: string;
      epoca: string; motivo: "truncate" | "replace" | "riscrittura" | "percorso" }
  | { tipo: "errore"; sessione: string; epoca: string | null;
      errore: ErroreCronologia };
