// Tipi esportati verso il renderer (via preload). Nessun legame con Electron.
import type { Situazione } from "./situazione";
import type { DeltaCronologia, ErroreCronologia, OpzioniCronologia, SnapshotPagina } from "./cronologia-tipi";

export type Sorgente = "claude-code" | "claude-desktop" | "codex" | "cursor";
export type Stato = "lavora" | "aspetta" | "ferma" | "finita";

export interface Prova {
  testo: string;
  fatta: boolean;
  /** Non fatta e l'ultimo tentativo del registro è rosso (`nota`). «In corso» il registro non lo scrive: non si mostra. */
  fallita?: boolean;
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
  /** Modalità dei permessi dell'ultimo messaggio di Roberto (`permissionMode` della trascrizione Claude Code): default, acceptEdits, plan, bypassPermissions. */
  permessi?: string | null;
  /** Token nel contesto all'ultima risposta (input, cache letta e creata); null se la sorgente non li dà. */
  contesto?: number | null;
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
  /** Solo per le sessioni dell'app Claude desktop: legami e dati che la trascrizione non ha. */
  app?: AppSessione;
}

export interface PrSessione { numero: number; stato: "aperta" | "unita" | "chiusa"; verso: string | null; url: string }

/** Dal file `local_*.json` dell'app Claude desktop. */
export interface AppSessione {
  /** `idApp` della sessione che l'ha avviata (`spawnedFrom`): la barra la mostra sotto la madre. */
  padre: string | null;
  prs: PrSessione[];
  /** Nomi dei connettori remoti (MCP) della sessione. */
  connettori: string[];
  strumentiMcp: number;
  /** Versione di Claude Code, «2.1.299». */
  cli: string | null;
  /** Macchina dove gira, se non è questo Mac (`sshConfig.sshHost`). */
  ospite: string | null;
  /** Controllo remoto attivo (la sessione ha un ponte). */
  remoto: boolean;
}

/** Una PR della sessione; `stato` null = la trascrizione dà solo il link (`pr-link`), non lo stato. */
export interface PrInfo { numero: number; url: string; stato: PrSessione["stato"] | null; verso: string | null }

/** Numeri che la trascrizione dà (`info-sessione.ts`): pannello «Info sessione». */
export interface InfoSessione {
  /** Token nel contesto dopo l'ultima risposta; null = nessuna risposta con il conteggio. */
  contesto: number | null;
  file: { quanti: number; aggiunte: number; tolte: number };
  /** Tutte le PR della sessione (file dell'app + `pr-link` della trascrizione); assente = nessuna. */
  prs?: PrInfo[];
}

export interface ErroreLettura {
  percorso: string;
  messaggio: string;
}

export interface Elenco {
  sessioni: Sessione[];
  errori: ErroreLettura[];
}

/** Un'immagine dentro una riga della trascrizione (messaggio incollato o esito di uno strumento): si rilegge a richiesta, mai portata nel messaggio. */
export interface RifImmagine {
  /** `uuid` della riga che la contiene. */
  riga: string;
  /** Posizione tra le immagini della riga, in ordine di lettura. */
  n: number;
  mime: string;
  byte: number;
  /** «Immagine 1» per quelle incollate; assente per gli esiti. */
  nome?: string;
}

export type Messaggio =
  | { tipo: "utente"; testo: string; t: number | null; immagini?: RifImmagine[] }
  | { tipo: "assistente"; testo: string; modello: string | null; t: number | null }
  | { tipo: "pensiero"; testo: string; t: number | null }
  | {
      tipo: "strumento";
      id: string;
      nome: string;
      ingresso: unknown;
      /** null finché l'esito non è arrivato. */
      esito: { testo: string; errore: boolean; immagini?: RifImmagine[] } | null;
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
  /** Comandi con «/» che la sessione conosce (suoi, dell'account e del progetto). */
  comandi(id: string): Promise<VoceComando[]>;
  /** Catalogo dei modelli del motore (`~/.claude/hooks/friday/modelli.json`, sola lettura); null se manca o non si legge. */
  modelli(): Promise<ModelloMotore[] | null>;
  /** File della cartella della sessione che contengono `testo` nel percorso (al massimo 8), per «@». */
  file(id: string, testo: string): Promise<string[]>;
  /** Byte su disco dell'indice e delle cache dell'app. */
  spazio(): Promise<{ indice: number; messaggi: number; immagini: number; altro: number }>;
  /** Contesto usato e file toccati di una sessione, dalla trascrizione. */
  info(id: string): Promise<InfoSessione>;
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

/** Un comando con «/» nel menu della casella; `gruppo`: «Comandi» o «Skill». */
/** Un modello del catalogo del motore: gli sforzi che accetta (`[]` = nessuno), se ha la modalità veloce, il predefinito. Un campo che il catalogo non dice manca. */
export interface ModelloMotore { modello: string; sforzi?: string[]; rapida?: boolean; contesto_max?: number; sforzo_default?: string }
export interface VoceComando { nome: string; descrizione: string; gruppo: "Comandi" | "Skill" }

export interface PreferenzeSessione {
  /** Nome di un'icona «Icona/…» del file Figma (NomeIcona in ui/base/icone.ts). */
  icona?: string;
  /** Nome di un colore «colore/sessione/…» del file Figma, es. «blu». */
  colore?: string;
  fissa?: boolean;
  nonLetta?: boolean;
  /** Nome dato in clotch (#460): sostituisce il titolo solo nell'app; la sessione sul disco non cambia. */
  nome?: string;
  /** Scelte della casella (#437): id del modello CLI (claude-opus-5-5, claude-fable-5-1, …) che #457 manda al motore; sforzo: low, medium, high, xhigh, max; modalità rapida; permessi: default, acceptEdits, plan, bypassPermissions. */
  modello?: string;
  sforzo?: string;
  rapida?: boolean;
  permessi?: string;
}

export type AzioneSessione = "nuova-finestra" | "copia-id" | "copia-cartella" | "copia-link" | "mostra-nel-finder" | "apri-terminale";

/** Un file scelto per la casella o scritto in fondo a un messaggio (`@percorso`). */
export interface FileAllegato { percorso: string; nome: string; tipo: "immagine" | "file" | "cartella"; byte: number | null }
/** Dove sta un'immagine: in una riga della trascrizione o su disco. */
export type DaImmagine = { sessione: string; rif: RifImmagine } | { percorso: string };
export interface SkillNome { nome: string }

/** `window.casella` (#437): tutto quello che la casella e il filo chiedono al Mac per allegati, immagini e skill. */
export interface CasellaApi {
  /** Finestra di scelta dei file e delle cartelle; [] se annullata. */
  scegli(): Promise<FileAllegato[]>;
  /** Nome, tipo e peso dei percorsi dati; un percorso che non si legge non c'è nel risultato. */
  descrivi(percorsi: string[]): Promise<FileAllegato[]>;
  /** Il percorso di un file trascinato nella finestra; "" se non sta sul disco. */
  percorso(file: File): string;
  /** Copia i file in «~/.claude/casella/allegati» (il motore accetta solo lì) e li descrive col nome di prima; un file oltre il limite resta dov'è. */
  copia(percorsi: string[]): Promise<FileAllegato[]>;
  /** Un'immagine incollata: il Mac la salva in «~/.claude/casella/allegati» e la descrive; null se non si salva. */
  incolla(mime: string, byte: Uint8Array): Promise<FileAllegato | null>;
  /** L'immagine come indirizzo `data:`; null se non si legge. Con `sessione` e `rif`: dalla trascrizione; con `percorso`: dal disco. */
  immagine(da: DaImmagine): Promise<string | null>;
  copiaImmagine(da: DaImmagine): Promise<boolean>;
  /** Finestra «Salva con nome»; false se annullata. */
  salvaImmagine(da: DaImmagine, nome: string): Promise<boolean>;
  /** Le skill dell'account della sessione, in ordine alfabetico. */
  skill(account: string): Promise<SkillNome[]>;
}

/** `window.clotchAi` (#352): l'unico modo dell'interfaccia per comandare clotch AI e leggere il suo registro. */
export interface ClotchAiApi {
  comando(cmd: import("./clotch-ai").Comando | import("./comandi-app").ComandoApp, args?: Record<string, unknown>): Promise<import("./comandi").EsitoComando>;
  /** Il registro senza Map: `daPiano` (ui/clotch-ai/registro.ts) lo riporta a `Registro`. */
  registro(): Promise<unknown>;
  onRegistro(cb: (registro: unknown) => void): () => void;
  /** `friday avvia`, quando clotch AI è spenta. */ // nome del protocollo del motore
  avvia(): Promise<{ ok: boolean; testo: string }>;
  /** L'app sta leggendo un avviso a voce (Clotch assente), e quando comincia o smette. */
  voce(): Promise<boolean>;
  onVoce(cb: (parla: boolean) => void): () => void;
  /** Dettatura dell'app (Clotch spento, #470): `true` apre il microfono nel main, `false` lo chiude; il testo capito torna con `onDettatura`. */
  dettatura(avvia: boolean): Promise<void>;
  onDettatura(cb: (e: import("./dettatura-app").EventoDettatura) => void): () => void;
}

/** Impostazioni dell'app (#351) nel file delle preferenze (`SessioniApi.impostazioni`); i valori di partenza sono quelli del disegno. */
export interface ImpostazioniApp {
  apriAllAvvio: boolean; barraDeiMenu: boolean; lingua: string; modello: string; apriSessione: string; cartellaRegistro: string;
  colore: string; carattere: string; dimensione: string; densita: string; pannelloAperto: boolean; iconeSessioni: boolean;
  /** Larghezza della barra laterale in px, se trascinata (frame 101:29399); assente = quella del disegno. */
  barraLarghezza?: number;
  avvisoAttesa: boolean; avvisoFinita: boolean; avvisoErrori: boolean; avvisoLimite: boolean; suono: string; silenzio: string;
  sorgenteClaudeCode: boolean; sorgenteClaude: boolean; sorgenteCodex: boolean; sorgenteCursor: boolean;
  /** Cartelle ~/.claude-* tolte o aggiunte a mano, oltre a quelle trovate dal main. */
  accountTolti: string[]; accountAggiunti: string[];
  comandiInteri: boolean; nascondiChiavi: boolean; cartelleEscluse: string[]; cronologia: string;
  /** «Rinomina etichetta…» (#460): nome mostrato per una cartella della barra, per nome originale; la cartella sul disco non cambia. */
  etichetteCartelle: Record<string, string>;
  aggiornamentiAutomatici: boolean;
  clotchVoce: boolean; clotchDettatura: boolean; clotchAvvisi: boolean; clotchObiettivi: boolean;
  /** Tasti per azione; null = scorciatoia tolta. */
  scorciatoie: Record<string, string | null>;
}

export interface CartellaAccount { percorso: string; dettaglio: string; errore: boolean }
/** `giorni`: uso al giorno dell'account (scheda Andamento), dal più vecchio a oggi; `giorno` = data ISO. `letto`: quando il feed ha letto i numeri (ms). */
export interface QuotaUso {
  account: string; usato: number; ripartenza: string; letto?: number;
  /** Per finestra (#478): percentuale usata (null senza dato) e quando riparte, in ms; `usato` resta quello del 7 giorni (100 se le 5 ore sono finite). */
  /** Email dell'account: è quella che chiedono `nuova_sessione` e `riprendi_altrove`. */
  email?: string;
  cinque?: number | null; cinqueFine?: number | null; sette?: number | null; setteFine?: number | null; giorni?: { giorno: string; v: number }[] }
/** `id` = id della sessione (CLI), serve a «Ripristina». */
export interface Archiviata { id: string; titolo: string; dove: string }

/** Chi usa l'app: nome intero e iniziali, per il piede della barra e il menu del profilo. */
export interface Profilo { nome: string; iniziali: string }

/** `window.impostazioni` (#351): tutto quello che le impostazioni chiedono al Mac, tranne i valori salvati. */
export interface ImpostazioniApi {
  /** Cartelle ~/.claude* trovate nella home. */
  radici(): Promise<string[]>;
  /** Una riga per cartella, con le sessioni lette o l'errore. */
  cartelle(percorsi: string[]): Promise<CartellaAccount[]>;
  scegliCartella(): Promise<string | null>;
  apri(percorso: string): Promise<void>;
  versione(): Promise<string>;
  /** Nome e iniziali dell'utente: dall'account Claude, se no da macOS. */
  profilo(): Promise<Profilo>;
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
  /** `true`: controlla, vero se c'è una versione nuova sul disco.
   *  `"installa"`: riapre l'app (vero se l'ha riaperta). */
  aggiornamenti(fai: boolean | "installa"): Promise<boolean>;
}

export interface Novita { data: string; voci: string[] }

/** Una cartella dove aprire una sessione: percorso assoluto e nome corto. */
export interface CartellaAvvio { percorso: string; nome: string }
/** Cosa c'è in una cartella: se è un repo git, i suoi rami locali e quello di partenza («dev», poi «main», poi quello attuale). */
export interface ContestoCartella { git: boolean; rami: string[]; predefinito: string | null }
/** `window.nuovaSessione`: le scelte di «Nuova sessione» che servono dati del Mac. Solo letture, più il dialogo di scelta. */
export interface NuovaSessioneApi {
  /** Le cartelle delle sessioni già lette, dalla più recente, e la cartella di casa (per «Nessuna cartella»). */
  cartelle(): Promise<{ recenti: CartellaAvvio[]; casa: string }>;
  contesto(cartella: string): Promise<ContestoCartella>;
  /** Gli `Host` di ~/.ssh/config, senza caratteri jolly. */
  ssh(): Promise<string[]>;
  /** Dialogo nativo «Apri cartella…»; null se annullato. */
  scegliCartella(): Promise<CartellaAvvio | null>;
}
