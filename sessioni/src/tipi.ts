// Tipi esportati verso il renderer (via preload). Nessun legame con Electron.
import type { Situazione } from "./situazione";

export type Sorgente = "claude-code" | "claude-desktop" | "codex" | "cursor";
export type Stato = "lavora" | "aspetta" | "ferma" | "finita";

export interface Prova {
  testo: string;
  fatta: boolean;
}

export interface Obiettivo {
  testo: string;
  /** aperto | proposto | raggiunto | bloccato | passato | rifiutato | nessuno, come nel registro. */
  stato: string;
  prove: Prova[];
  /** false = il registro non è firmato: l'obiettivo non va mostrato. */
  valido: boolean;
}

export interface Sessione {
  id: string;
  sorgente: Sorgente;
  /** Cartella della radice (`.claude`, `.claude-roberto`) o `codex`, `cursor`. */
  account: string;
  email: string | null;
  /** Id `local_…` dell'app Claude desktop (serve al link `claude://code/continue?session=`). */
  idApp: string | null;
  titolo: string;
  progetto: string;
  cartella: string;
  ramo: string | null;
  modello: string | null;
  stato: Stato;
  /** Perché lo stato (frase del registro `sessioni-stato`), se c'è. */
  perche: string | null;
  /** Millisecondi epoch dell'ultima attività. */
  ultimaAttivita: number;
  obiettivo: Obiettivo | null;
  /** Cosa succede adesso secondo la coda della trascrizione; null se la sorgente non lo dice (Cursor, app senza file). */
  situazione: Situazione | null;
  /** File da cui è stata letta: serve a `messaggi()` e all'osservatore. */
  file: string;
}

export interface ErroreLettura {
  percorso: string;
  messaggio: string;
}

export interface Elenco {
  sessioni: Sessione[];
  errori: ErroreLettura[];
}

export type Messaggio =
  | { tipo: "utente"; testo: string; t: number | null }
  | { tipo: "assistente"; testo: string; modello: string | null; t: number | null }
  | { tipo: "pensiero"; testo: string; t: number | null }
  | {
      tipo: "strumento";
      id: string;
      nome: string;
      ingresso: unknown;
      /** null finché l'esito non è arrivato. */
      esito: { testo: string; errore: boolean } | null;
      t: number | null;
    }
  | { tipo: "errore"; testo: string; t: number | null };

export interface PaginaMessaggi {
  /** In ordine di tempo. Pagina 0 = i più recenti. */
  messaggi: Messaggio[];
  pagina: number;
  haAltre: boolean;
  errore: string | null;
}

export interface Aggiornamento {
  /** Ids delle sessioni nuove o cambiate (da rileggere con `elencoSessioni()`) e dei messaggi arrivati. */
  sessioni: string[];
  nuoviMessaggi: { id: string; messaggi: Messaggio[] }[];
}

export interface SessioniApi {
  elencoSessioni(): Promise<Elenco>;
  messaggi(id: string, pagina: number): Promise<PaginaMessaggi>;
  onAggiornamento(cb: (a: Aggiornamento) => void): () => void;
  /** Preferenze dell'app per id di sessione (#360). */
  preferenze(): Promise<Record<string, PreferenzeSessione>>;
  /** Unisce `parte` (un campo a null si toglie); `onPreferenze` riceve il nuovo insieme. */
  impostaPreferenze(id: string, parte: { [K in keyof PreferenzeSessione]?: PreferenzeSessione[K] | null }): Promise<void>;
  onPreferenze(cb: (p: Record<string, PreferenzeSessione>) => void): () => void;
  azione(id: string, azione: AzioneSessione): Promise<void>;
}

export interface PreferenzeSessione {
  /** Nome di un'icona «Icona/…» del file Figma (NomeIcona in ui/base/icone.ts). */
  icona?: string;
  /** Nome di un colore «colore/sessione/…» del file Figma, es. «blu». */
  colore?: string;
  fissa?: boolean;
  nonLetta?: boolean;
}

export type AzioneSessione = "nuova-finestra" | "copia-id" | "copia-cartella" | "copia-link" | "mostra-nel-finder";

/** `window.friday` (#352): l'unico modo dell'interfaccia per comandare Friday e leggere il suo registro. */
export interface FridayApi {
  comando(cmd: import("./friday").Comando, args?: Record<string, unknown>): Promise<import("./comandi").EsitoComando>;
  /** Il registro senza Map: `daPiano` (ui/friday/registro.ts) lo riporta a `Registro`. */
  registro(): Promise<unknown>;
  onRegistro(cb: (registro: unknown) => void): () => void;
  /** `friday avvia`, quando Friday è spenta. */
  avvia(): Promise<{ ok: boolean; testo: string }>;
}

/** `window.impostazioni` (#351): impostazioni dell'app in userData (src/impostazioni.ts). Quelle di Friday passano da `window.friday`. */
export interface ImpostazioniApi {
  leggi(): Promise<Record<string, unknown>>;
  scrivi(parte: Record<string, unknown>): Promise<Record<string, unknown>>;
  radici(): Promise<{ percorso: string; account: string }[]>;
  scegliCartella(): Promise<string | null>;
  apri(percorso: string): Promise<void>;
  versione(): Promise<string>;
}
