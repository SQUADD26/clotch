// Sessioni dell'app Claude desktop: ~/Library/Application Support/[Cc]laude*/claude-code-sessions/**/local_*.json
import * as fs from "node:fs";
import * as path from "node:path";
import { trovaFile } from "./jsonl";
import { aMillisecondi } from "./registri";
import { ErroreLettura } from "./tipi";

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
}

const testo = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export function leggiApp(home: string, errori: ErroreLettura[]): SessioneApp[] {
  const support = path.join(home, "Library", "Application Support");
  let profili: string[] = [];
  try {
    profili = fs.readdirSync(support).filter((n) => /^[Cc]laude/.test(n)).sort();
  } catch {
    return [];
  }
  const out: SessioneApp[] = [];
  for (const profilo of profili) {
    const dir = path.join(support, profilo, "claude-code-sessions");
    for (const file of trovaFile(dir, (n) => /^local_.*\.json$/.test(n), errori)) {
      let d: any;
      try {
        d = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        continue; // file a metà scrittura: si salta
      }
      // come Clotch: niente attività pianificate e niente sessioni senza id CLI
      if (!d || testo(d.scheduledTaskId) || !testo(d.cliSessionId)) continue;
      out.push({
        idApp: testo(d.sessionId) ?? path.basename(file, ".json"),
        cliId: d.cliSessionId,
        titolo: testo(d.title) ?? "",
        cartella: testo(d.cwd) ?? testo(d.originCwd),
        ramo: testo(d.branch) ?? testo(d.gitBranch), // shortcut: nomi non verificati su un file vero, il Mac li conferma
        modello: testo(d.model),
        inCorso: d.isRunning === true,
        archiviata: d.isArchived === true,
        ultimaAttivita: aMillisecondi(d.lastActivityAt),
        profilo,
        file,
      });
    }
  }
  return out;
}
