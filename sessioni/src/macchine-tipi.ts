// Le macchine SSH del motore (contratto v1, sezione 3: `macchine`, `macchina_aggiungi`, `macchina_togli`, evento `macchina_passo`). Solo tipi: li leggono main e renderer.
// Della chiave si sa sempre e solo il percorso del file, mai il contenuto.

/** Una macchina del registro del motore. `fonte` `tabella` = di base (locale e sandbox): non si toglie dall'app. */
export interface Macchina {
  nome: string; host: string; porta: number; utente: string; chiave: string | null; cartella: string;
  stato: "pronta" | "da_completare"; fonte: string; locale: boolean;
  /** Il passo dove la preparazione si è fermata, e perché; `comando` = cosa fare nel Terminale del Mac. */
  passo: string | null; testo: string | null; comando: string | null;
}
/** Una connessione SSH salvata in Claude Desktop, non ancora registrata. */
export interface Proposta { desktop_id: string; nome: string; host: string; porta: number; utente: string; chiave: string | null }

/** Un passo della preparazione, come lo dà `macchina_aggiungi` (`passi`). `url` e `codice`: accesso a GitHub con il codice di verifica (device flow, claude-config#2618), al posto del comando. */
export interface EsitoPasso { passo: string; ok: boolean; testo: string | null; comando: string | null; url?: string | null; codice?: string | null }
/** L'evento `macchina_passo` del registro: `ok` assente (null) = il passo è iniziato. */
export interface PassoMacchina extends Omit<EsitoPasso, "ok"> { nome: string; ok: boolean | null; t: number }
