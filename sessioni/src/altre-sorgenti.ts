// Codex (~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl) e Cursor (~/.cursor/projects/<p>/agent-transcripts/**).
import * as fs from "node:fs";
import * as path from "node:path";
import { testaECoda, trovaFile, msgErrore } from "./jsonl";
import { nomeProgetto } from "./claude-code";
import { aMillisecondi } from "./registri";
import { situazioneCodex } from "./situazione";
import { ErroreLettura, Sessione } from "./tipi";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const base = (): Sessione => ({
  id: "", sorgente: "codex", account: "", email: null, idApp: null, titolo: "", progetto: "", cartella: "", ramo: null, modello: null,
  stato: "ferma", perche: null, ultimaAttivita: 0, obiettivo: null, situazione: null, file: "",
});

// Come claude-code.ts, ma la chiave ha anche inode e ctime: un file sostituito o riscritto con la stessa misura e lo stesso mtime si rilegge.
// Ogni giro tiene solo i file che ha visto: quelli spariti escono dalla memoria.
type Cache = Map<string, { chiave: string; s: Sessione }>;
let cacheCodex: Cache = new Map(), cacheCursor: Cache = new Map();
function dalCache(vecchia: Cache, nuova: Cache, file: string, st: fs.Stats, crea: () => Sessione): Sessione {
  const chiave = `${st.ino}:${st.mtimeMs}:${st.ctimeMs}:${st.size}`;
  const e = vecchia.get(file);
  const s = e && e.chiave === chiave ? e.s : crea();
  nuova.set(file, { chiave, s });
  return { ...s };
}

function daCodex(file: string, st: fs.Stats): Sessione {
  const { testa, coda } = testaECoda(file, st.size, 256 * 1024);
  const meta = testa.find((o) => o.type === "session_meta")?.payload ?? {};
  const ctx = [...coda].reverse().find((o) => o.type === "turn_context")?.payload ?? testa.find((o) => o.type === "turn_context")?.payload ?? {};
  const cartella = meta.cwd ?? ctx.cwd ?? "";
  const primoUtente = testa.find((o) => o.type === "event_msg" && o.payload?.type === "user_message")?.payload?.message;
  return {
    ...base(),
    id: meta.id ?? (path.basename(file, ".jsonl").match(/[0-9a-f-]{36}$/i)?.[0] ?? path.basename(file, ".jsonl")),
    account: "codex",
    titolo: String(primoUtente ?? "").slice(0, 200),
    progetto: nomeProgetto(cartella),
    cartella,
    ramo: meta.git?.branch ?? null,
    modello: ctx.model ?? null,
    situazione: situazioneCodex(coda),
    ultimaAttivita: [...coda].reverse().map((o) => aMillisecondi(o.timestamp)).find((x) => x !== null) ?? st.mtimeMs,
    file,
  };
}

export function leggiCodex(home: string, env: NodeJS.ProcessEnv, errori: ErroreLettura[]): Sessione[] {
  const radici = [...new Set([path.join(home, ".codex"), env.CODEX_HOME].filter((r): r is string => !!r))];
  const out: Sessione[] = [], nuova: Cache = new Map();
  for (const r of radici) {
    for (const file of trovaFile(path.join(r, "sessions"), (n) => /^rollout-.*\.jsonl$/.test(n), errori)) {
      try {
        const st = fs.statSync(file);
        out.push(dalCache(cacheCodex, nuova, file, st, () => daCodex(file, st)));
      } catch (e: any) {
        errori.push({ percorso: file, messaggio: msgErrore(e) });
      }
    }
  }
  cacheCodex = nuova;
  return out;
}

function daCursor(file: string, st: fs.Stats, id: string, cartella: string): Sessione {
  const { testa } = testaECoda(file, st.size);
  const primo = testa.find((o) => o.role === "user")?.message?.content;
  const testo = (Array.isArray(primo) ? primo.map((b: any) => b?.text ?? "").join("") : String(primo ?? "")).replace(/<\/?user_query>/g, "").trim();
  return { ...base(), id, sorgente: "cursor", account: "cursor", titolo: testo.slice(0, 200), progetto: cartella, cartella, ultimaAttivita: st.mtimeMs, file };
}

/** Cursor: un sottoagente (`.../subagents/<figlio>.jsonl`) è piegato nel padre, non compare da solo. */
export function leggiCursor(home: string, errori: ErroreLettura[]): Sessione[] {
  const out: Sessione[] = [], nuova: Cache = new Map();
  const dir = path.join(home, ".cursor", "projects");
  for (const file of trovaFile(dir, (n) => n.endsWith(".jsonl"), errori)) {
    const parti = file.slice(dir.length + 1).split("/");
    const i = parti.lastIndexOf("agent-transcripts");
    if (i < 0 || !UUID.test(parti[i + 1] ?? "") || parti.length !== i + 3 || path.basename(parti[i + 2], ".jsonl") !== parti[i + 1]) continue;
    try {
      const st = fs.statSync(file);
      // shortcut: la cartella è codificata con '-' al posto di '/', non si risale al percorso vero
      out.push(dalCache(cacheCursor, nuova, file, st, () => daCursor(file, st, parti[i + 1], parti[0])));
    } catch (e: any) {
      errori.push({ percorso: file, messaggio: msgErrore(e) });
    }
  }
  cacheCursor = nuova;
  return out;
}
