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
}
