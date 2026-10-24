// Sessioni dell'app Claude desktop: ~/Library/Application Support/[Cc]laude*/claude-code-sessions/**/local_*.json
import * as fs from "node:fs";
import * as path from "node:path";
import { trovaFile } from "./jsonl";
import { aMillisecondi } from "./registri";
import { AppSessione, ErroreLettura, PrSessione } from "./tipi";

export interface SessioneApp {
  idApp: string;
  cliId: string;
  titolo: string;
  cartella: string | null;
  ramo: string | null;
  modello: string | null;
  inCorso: boolean;
  archiviata: boolean;
  ultimaAttivita: number | null;
  /** Profilo dell'app: `Claude`, `Claude-x`. */
  profilo: string;
  file: string;
  app?: AppSessione;
}

const testo = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

const STATO_PR: Record<string, PrSessione["stato"]> = { OPEN: "aperta", MERGED: "unita", CLOSED: "chiusa" };

/** Legami e dati del file dell'app che la trascrizione non ha. Le PR tolte dalla persona (`dismissed`) non contano. */
export function datiApp(d: any): AppSessione {
  const prs: PrSessione[] = (Array.isArray(d.prs) ? d.prs : [])
    .filter((p: any) => p && !p.dismissed && Number.isInteger(p.prNumber) && STATO_PR[p.state] && testo(p.url))
    .map((p: any) => ({ numero: p.prNumber, stato: STATO_PR[p.state], verso: testo(p.baseRef), url: p.url }));
  return {
    padre: testo(d.spawnedFrom?.sessionId),
    prs,
    connettori: (Array.isArray(d.remoteMcpServersConfig) ? d.remoteMcpServersConfig : []).map((c: any) => testo(c?.name)).filter((n: string | null): n is string => !!n),
    strumentiMcp: Object.values(d.enabledMcpTools ?? {}).filter((v) => v === true).length,
    cli: testo(d.toolSurfaceSnapshot?.cliVersion),
    ospite: testo(d.sshConfig?.sshHost),
    // shortcut: «controllo remoto» = la sessione ha un ponte (bridgeSessionIds); il file non dice altro, si conferma sul Mac
    remoto: Array.isArray(d.bridgeSessionIds) && d.bridgeSessionIds.length > 0,
  };
}

// Cache per file come altre-sorgenti.ts: chiave inode:mtime:ctime:size; ogni giro tiene solo i file visti (gli spariti escono).
// null = file letto ma scartato (attività pianificata, senza id CLI): invariato, non si rilegge. Un file illeggibile non entra.
let cache = new Map<string, { chiave: string; s: SessioneApp | null }>();

function daFile(file: string, profilo: string): SessioneApp | null | undefined {
  let d: any;
  try {
    d = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return undefined; // file a metà scrittura: si salta
  }
  // come Clotch: niente attività pianificate e niente sessioni senza id CLI
  if (!d || testo(d.scheduledTaskId) || !testo(d.cliSessionId)) return null;
  return {
    idApp: testo(d.sessionId) ?? path.basename(file, ".json"),
    cliId: d.cliSessionId,
    titolo: testo(d.title) ?? "",
    cartella: testo(d.cwd) ?? testo(d.originCwd),
    ramo: testo(d.branch) ?? testo(d.gitBranch), // shortcut: nomi non verificati su un file vero, il Mac li conferma
    modello: testo(d.model),
    // I file veri non hanno isRunning: l'app scrive postTurnSummaryFor (= lastAssistantUuid) solo a turno chiuso. Archiviata = non in corso (#340).
    inCorso: d.isArchived !== true && testo(d.lastAssistantUuid) !== null && d.postTurnSummaryFor !== d.lastAssistantUuid,
    archiviata: d.isArchived === true,
    ultimaAttivita: aMillisecondi(d.lastActivityAt),
    profilo,
    file,
    app: datiApp(d),
  };
}

export function leggiApp(home: string, errori: ErroreLettura[]): SessioneApp[] {
  const support = path.join(home, "Library", "Application Support");
  let profili: string[] = [];
  try {
    profili = fs.readdirSync(support).filter((n) => /^[Cc]laude/.test(n)).sort();
  } catch {
    cache = new Map();
    return [];
  }
  const out: SessioneApp[] = [], nuova: typeof cache = new Map();
  for (const profilo of profili) {
    const dir = path.join(support, profilo, "claude-code-sessions");
    for (const file of trovaFile(dir, (n) => /^local_.*\.json$/.test(n), errori)) {
      let st: fs.Stats;
      try {
        st = fs.statSync(file);
      } catch {
        continue; // sparito tra l'elenco e la lettura
      }
      const chiave = `${st.ino}:${st.mtimeMs}:${st.ctimeMs}:${st.size}`, e = cache.get(file);
      const s = e && e.chiave === chiave ? e.s : daFile(file, profilo);
      if (s === undefined) continue;
      nuova.set(file, { chiave, s });
      if (s) out.push({ ...s });
    }
  }
  cache = nuova;
  return out;
}
