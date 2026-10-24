// L'unico modulo dell'app che manda comandi a clotch AI (#352): scrive il file nella casella
// e aspetta la riga `comando_fatto` nel registro (contratto v1, sezione 3). Chat e impostazioni usano questo.
import * as fs from "node:fs";
import * as path from "node:path";
import { msgErrore, parseRiga, righeNuove } from "./jsonl";
import { cartellaRegistro, Comando, mandaComando } from "./clotch-ai";
import type { EsitoPasso, Macchina, Proposta } from "./macchine-tipi";

/** `account_previsto` (contratto 3, #2599): con quale account partirebbe una sessione nuova; uso in %, reset ISO. */
export interface AccountPrevisto { email: string; config_dir: string | null; uso_5h: number | null; uso_7g: number | null; reset_5h: string | null; reset_7g: string | null; scelto: boolean; motivo: string }

export type EsitoComando =
  /** clotch AI ha risposto con `comando_fatto`. */
  | { id: string; esito: "ok" | "rifiutato" | "errore"; testo: string; pr?: number; nonFermate?: string[]; /** nuova_sessione: la sessione nata e la macchina dove gira. */ sessione?: string; macchina?: string; account?: AccountPrevisto; /** trascrizione_remota: la copia sul Mac, la sua dimensione e da dove viene. */ percorso?: string; byte?: number; fonte?: string;
      /** `macchine`: il registro e le connessioni di Claude Desktop da aggiungere. `macchina_aggiungi`: la voce (`voce`) e i passi fatti. */ macchine?: Macchina[]; proposte?: Proposta[]; voce?: Macchina; passi?: EsitoPasso[] }
  /** La casella non si può scrivere: il comando non è partito. */
  | { id: null; esito: "non_scritto"; testo: string }
  /** Nessuna risposta in tempo. `preso: false` = clotch AI non l'ha preso (spenta): il file è stato ritirato e non partirà più. */
  | { id: string; esito: "scaduto"; testo: string; preso: boolean };

export interface OpzioniComando { env?: NodeJS.ProcessEnv; scadenzaMs?: number; ogniMs?: number }

const MESE = /^\d{4}-\d{2}\.jsonl$/;
const mesi = (dir: string) => { try { return fs.readdirSync(dir).filter((n) => MESE.test(n)); } catch { return []; } };

/** Righe del registro scritte da ora in poi (anche in un file di mese nuovo). */
function righeDaOra(dir: string): () => any[] {
  const pos = new Map<string, number>();
  for (const m of mesi(dir)) try { pos.set(m, fs.statSync(path.join(dir, m)).size); } catch {}
  return () => mesi(dir).flatMap((m) => {
    try {
      const r = righeNuove(path.join(dir, m), pos.get(m) ?? 0);
      pos.set(m, r.offset);
      return r.righe.map(parseRiga).filter(Boolean);
    } catch { return []; } // file sparito o illeggibile: si riprova al giro dopo
  });
}

/** Toglie dalla casella il comando non ancora preso. Vero se l'ha tolto. */
function ritira(home: string, id: string): boolean {
  const dir = path.join(home, ".claude", "casella", "comandi");
  try {
    const f = fs.readdirSync(dir).find((n) => n.endsWith(`-${id}.json`));
    if (!f) return false;
    fs.unlinkSync(path.join(dir, f));
    return true;
  } catch { return false; } // clotch AI l'ha preso proprio ora
}

const inVolo = new Map<string, Promise<EsitoComando>>();

/** Doppio invio o doppio clic: lo stesso comando con gli stessi argomenti ancora in attesa è lo stesso comando, un file solo nella casella. */
export function inviaComando(home: string, cmd: Comando, args: Record<string, unknown> = {}, o: OpzioniComando = {}): Promise<EsitoComando> {
  let chiave: string;
  try { chiave = `${home}\0${cmd}\0${JSON.stringify(args)}`; } catch { return invia(home, cmd, args, o); } // argomenti non serializzabili: l'errore lo dà la scrittura
  let p = inVolo.get(chiave);
  if (!p) inVolo.set(chiave, p = invia(home, cmd, args, o).finally(() => inVolo.delete(chiave)));
  return p;
}

async function invia(home: string, cmd: Comando, args: Record<string, unknown>, o: OpzioniComando): Promise<EsitoComando> {
  const { env = {}, scadenzaMs = 30_000, ogniMs = 250 } = o;
  const nuove = righeDaOra(cartellaRegistro(home, env)); // prima di scrivere: la risposta non può sfuggire
  let id: string;
  try { id = mandaComando(home, cmd, args); } catch (e) { return { id: null, esito: "non_scritto", testo: msgErrore(e) }; }
  const limite = Date.now() + scadenzaMs;
  for (;;) {
    for (const r of nuove()) {
      if (r.v !== 1 || r.tipo !== "comando_fatto" || r.dati?.comando !== id) continue;
      const e = r.dati.esito;
      const fatto: EsitoComando = { id, esito: e === "ok" || e === "rifiutato" ? e : "errore", testo: String(r.dati.testo ?? "") };
      if (Number.isInteger(r.dati.pr)) fatto.pr = r.dati.pr; // regola: la PR aperta da clotch AI
      if (typeof r.dati.sessione === "string") fatto.sessione = r.dati.sessione; // nuova_sessione
      if (typeof r.dati.percorso === "string") { fatto.percorso = r.dati.percorso; fatto.fonte = String(r.dati.fonte ?? ""); if (Number.isInteger(r.dati.byte)) fatto.byte = r.dati.byte; } // trascrizione_remota
      if (typeof r.dati.macchina === "string") fatto.macchina = r.dati.macchina;
      else if (r.dati.macchina && typeof r.dati.macchina === "object") fatto.voce = r.dati.macchina; // macchina_aggiungi
      if (Array.isArray(r.dati.macchine)) fatto.macchine = r.dati.macchine;
      if (Array.isArray(r.dati.proposte)) fatto.proposte = r.dati.proposte;
      if (Array.isArray(r.dati.passi)) fatto.passi = r.dati.passi;
      if (Array.isArray(r.dati.non_fermate)) fatto.nonFermate = r.dati.non_fermate.map(String); // ferma_tutto
      if (r.dati.account && typeof r.dati.account === "object") fatto.account = r.dati.account; // account_previsto
      return fatto;
    }
    if (Date.now() >= limite) return { id, esito: "scaduto", testo: "", preso: !ritira(home, id) };
    await new Promise((ok) => setTimeout(ok, ogniMs));
  }
}
