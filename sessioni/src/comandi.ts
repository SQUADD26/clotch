// L'unico modulo dell'app che manda comandi a Friday (#352): scrive il file nella casella
// e aspetta la riga `comando_fatto` nel registro (contratto v1, sezione 3). Chat e impostazioni usano questo.
import * as fs from "node:fs";
import * as path from "node:path";
import { msgErrore, parseRiga, righeNuove } from "./jsonl";
import { cartellaRegistro, Comando, mandaComando } from "./friday";

export type EsitoComando =
  /** Friday ha risposto con `comando_fatto`. */
  | { id: string; esito: "ok" | "rifiutato" | "errore"; testo: string }
  /** La casella non si può scrivere: il comando non è partito. */
  | { id: null; esito: "non_scritto"; testo: string }
  /** Nessuna risposta in tempo. `preso: false` = Friday non l'ha preso (spenta): il file è stato ritirato e non partirà più. */
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
  } catch { return false; } // Friday l'ha preso proprio ora
}

export async function inviaComando(home: string, cmd: Comando, args: Record<string, unknown> = {}, o: OpzioniComando = {}): Promise<EsitoComando> {
  const { env = {}, scadenzaMs = 30_000, ogniMs = 250 } = o;
  const nuove = righeDaOra(cartellaRegistro(home, env)); // prima di scrivere: la risposta non può sfuggire
  let id: string;
  try { id = mandaComando(home, cmd, args); } catch (e) { return { id: null, esito: "non_scritto", testo: msgErrore(e) }; }
  const limite = Date.now() + scadenzaMs;
  for (;;) {
    for (const r of nuove()) {
      if (r.v !== 1 || r.tipo !== "comando_fatto" || r.dati?.comando !== id) continue;
      const e = r.dati.esito;
      return { id, esito: e === "ok" || e === "rifiutato" ? e : "errore", testo: String(r.dati.testo ?? "") };
    }
    if (Date.now() >= limite) return { id, esito: "scaduto", testo: "", preso: !ritira(home, id) };
    await new Promise((ok) => setTimeout(ok, ogniMs));
  }
}
