// Tipi esportati verso il renderer (via preload). Nessun legame con Electron.
import type { Situazione } from "./situazione";
import type { DeltaCronologia, ErroreCronologia, OpzioniCronologia, SnapshotPagina } from "./cronologia-tipi";

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
  /** Nel protocollo v1: totaleSnapshot; legacy: conteggio dell'indice se aggiornato. */
  totale: number | null;
  /** Presente nelle risposte al protocollo v1 riuscite. */
  cronologia?: SnapshotPagina;
  /** Errore previsto: nessun cursore o watermark del renderer deve avanzare. */
  erroreCronologia?: ErroreCronologia;
}

export interface Aggiornamento {
  /** Ids delle sessioni nuove o cambiate (da rileggere con `elencoSessioni()`) e dei messaggi arrivati. */
  sessioni: string[];
  nuoviMessaggi: { id: string; messaggi: Messaggio[] }[];
  /** Con v1 è questa la fonte della chat; nuoviMessaggi resta per i consumatori legacy. */
  cronologia?: DeltaCronologia[];
}

export interface SessioniApi {
  elencoSessioni(): Promise<Elenco>;
  messaggi(id: string, pagina: number, opzioni?: OpzioniCronologia): Promise<PaginaMessaggi>;
  onAggiornamento(cb: (a: Aggiornamento) => void): () => void;
  /** Preferenze dell'app per id di sessione (#360). */
  preferenze(): Promise<Record<string, PreferenzeSessione>>;
  /** Unisce `parte` (un campo a null si toglie); `onPreferenze` riceve il nuovo insieme. */
  impostaPreferenze(id: string, parte: { [K in keyof PreferenzeSessione]?: PreferenzeSessione[K] | null }): Promise<void>;
  onPreferenze(cb: (p: Record<string, PreferenzeSessione>) => void): () => void;
  azione(id: string, azione: AzioneSessione): Promise<void>;
  /** Impostazioni dell'app (#368), nello stesso file delle preferenze: `imposta` unisce (null toglie), `on` riceve il nuovo insieme. */
  impostazioni(): Promise<Record<string, unknown>>;
  impostaImpostazioni(parte: Record<string, unknown>): Promise<void>;
  onImpostazioni(cb: (i: Record<string, unknown>) => void): () => void;
  /** Ricerca nell'indice del main (#368): titoli e testo di utente e assistente, al massimo 50 righe. */
  cerca(testo: string): Promise<RisultatoRicerca[]>;
  /** Byte su disco dell'indice e delle cache dell'app. */
  spazio(): Promise<{ indice: number; messaggi: number; immagini: number; altro: number }>;
  /** Rifà l'indice da capo; si risolve quando ha finito. */
  ricostruisci(): Promise<void>;
  /** Toglie l'indice e le cache dal disco. */
  svuota(): Promise<void>;
}

/** Una sessione trovata: l'ultimo messaggio che contiene il testo (`frammento` intorno al punto), o il titolo se nessuno. */
export interface RisultatoRicerca {
  id: string;
  titolo: string;
  frammento: string;
  /** Tempo del messaggio trovato; null se trovata solo nel titolo o se la sorgente non lo dà. */
  t: number | null;
  nelTitolo: boolean;
}

export interface PreferenzeSessione {
  /** Nome di un'icona «Icona/…» del file Figma (NomeIcona in ui/base/icone.ts). */
  icona?: string;
  /** Nome di un colore «colore/sessione/…» del file Figma, es. «blu». */
  colore?: string;
  fissa?: boolean;
  nonLetta?: boolean;
}

export type AzioneSessione = "nuova-finestra" | "copia-id" | "copia-cartella" | "copia-link" | "mostra-nel-finder" | "apri-terminale";

/** `window.friday` (#352): l'unico modo dell'interfaccia per comandare Friday e leggere il suo registro. */
export interface FridayApi {
  comando(cmd: import("./friday").Comando | import("./comandi-app").ComandoApp, args?: Record<string, unknown>): Promise<import("./comandi").EsitoComando>;
  /** Il registro senza Map: `daPiano` (ui/friday/registro.ts) lo riporta a `Registro`. */
  registro(): Promise<unknown>;
  onRegistro(cb: (registro: unknown) => void): () => void;
  /** `friday avvia`, quando Friday è spenta. */
  avvia(): Promise<{ ok: boolean; testo: string }>;
}

/** Impostazioni dell'app (#351) nel file delle preferenze (`SessioniApi.impostazioni`); i valori di partenza sono quelli del disegno. */
export interface ImpostazioniApp {
  apriAllAvvio: boolean; barraDeiMenu: boolean; lingua: string; modello: string; apriSessione: string; cartellaRegistro: string;
  colore: string; carattere: string; dimensione: string; densita: string; pannelloAperto: boolean; iconeSessioni: boolean;
  avvisoAttesa: boolean; avvisoFinita: boolean; avvisoErrori: boolean; avvisoLimite: boolean; suono: string; silenzio: string;
  sorgenteClaudeCode: boolean; sorgenteClaude: boolean; sorgenteCodex: boolean; sorgenteCursor: boolean;
  /** Cartelle ~/.claude-* tolte o aggiunte a mano, oltre a quelle trovate dal main. */
  accountTolti: string[]; accountAggiunti: string[];
  comandiInteri: boolean; nascondiChiavi: boolean; cartelleEscluse: string[]; cronologia: string;
  aggiornamentiAutomatici: boolean;
  clotchVoce: boolean; clotchDettatura: boolean; clotchAvvisi: boolean; clotchObiettivi: boolean;
  /** Tasti per azione; null = scorciatoia tolta. */
  scorciatoie: Record<string, string | null>;
}

export interface CartellaAccount { percorso: string; dettaglio: string; errore: boolean }
/** `giorni`: uso al giorno dell'account (scheda Andamento), dal più vecchio a oggi; `giorno` = data ISO. `letto`: quando il feed ha letto i numeri (ms). */
export interface QuotaUso { account: string; usato: number; ripartenza: string; letto?: number; giorni?: { giorno: string; v: number }[] }
/** `id` = id della sessione (CLI), serve a «Ripristina». */
export interface Archiviata { id: string; titolo: string; dove: string }

/** `window.impostazioni` (#351): tutto quello che le impostazioni chiedono al Mac, tranne i valori salvati. */
export interface ImpostazioniApi {
  /** Cartelle ~/.claude* trovate nella home. */
  radici(): Promise<string[]>;
  /** Una riga per cartella, con le sessioni lette o l'errore. */
  cartelle(percorsi: string[]): Promise<CartellaAccount[]>;
  scegliCartella(): Promise<string | null>;
  apri(percorso: string): Promise<void>;
  versione(): Promise<string>;
  /** «Apri all'avvio del Mac»: voce degli elementi di login. */
  avvio(acceso: boolean): Promise<void>;
  /** Quote d'uso per account, dal feed di Clotch (cache 60 s nel main); lancia se il feed non risponde. */
  uso(): Promise<QuotaUso[] | null>;
  /** Sessioni archiviate (#375). */
  archiviate(): Promise<Archiviata[]>;
  /** «Elimina dati…»: toglie indice, cache e impostazioni dell'app; le sessioni originali non si toccano. */
  eliminaDati(): Promise<void>;
  /** Note della versione in uso; null finché non c'è una fonte. */
  novita(): Promise<Novita | null>;
  /** `false`: c'è un modo di controllare gli aggiornamenti? `true`: controlla. */
  aggiornamenti(fai: boolean): Promise<boolean>;
}

export interface Novita { data: string; voci: string[] }
