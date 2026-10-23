// Codex (~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl) e Cursor (~/.cursor/projects/<p>/agent-transcripts/**).
import * as fs from "node:fs";
import * as path from "node:path";
import { testaECoda, trovaFile, msgErrore } from "./jsonl";
import { nomeProgetto } from "./claude-code";
import { aMillisecondi } from "./registri";
import { ErroreLettura, Sessione } from "./tipi";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const base = (): Sessione => ({
  id: "", sorgente: "codex", account: "", email: null, idApp: null, titolo: "", progetto: "", cartella: "", ramo: null, modello: null,
  stato: "ferma", perche: null, ultimaAttivita: 0, obiettivo: null, file: "",
});

export function leggiCodex(home: string, env: NodeJS.ProcessEnv, errori: ErroreLettura[]): Sessione[] {
  const radici = [...new Set([path.join(home, ".codex"), env.CODEX_HOME].filter((r): r is string => !!r))];
  const out: Sessione[] = [];
  for (const r of radici) {
    for (const file of trovaFile(path.join(r, "sessions"), (n) => /^rollout-.*\.jsonl$/.test(n), errori)) {
      try {
        const st = fs.statSync(file);
        const { testa, coda } = testaECoda(file, st.size, 256 * 1024);
        const meta = testa.find((o) => o.type === "session_meta")?.payload ?? {};
        const ctx = [...coda].reverse().find((o) => o.type === "turn_context")?.payload ?? testa.find((o) => o.type === "turn_context")?.payload ?? {};
        const cartella = meta.cwd ?? ctx.cwd ?? "";
        const primoUtente = testa.find((o) => o.type === "event_msg" && o.payload?.type === "user_message")?.payload?.message;
        out.push({
          ...base(),
          id: meta.id ?? (path.basename(file, ".jsonl").match(/[0-9a-f-]{36}$/i)?.[0] ?? path.basename(file, ".jsonl")),
          account: "codex",
          titolo: String(primoUtente ?? "").slice(0, 200),
          progetto: nomeProgetto(cartella),
          cartella,
          ramo: meta.git?.branch ?? null,
          modello: ctx.model ?? null,
          ultimaAttivita: [...coda].reverse().map((o) => aMillisecondi(o.timestamp)).find((x) => x !== null) ?? st.mtimeMs,
          file,
        });
      } catch (e: any) {
        errori.push({ percorso: file, messaggio: msgErrore(e) });
      }
    }
  }
  return out;
}

/** Cursor: un sottoagente (`.../subagents/<figlio>.jsonl`) è piegato nel padre, non compare da solo. */
export function leggiCursor(home: string, errori: ErroreLettura[]): Sessione[] {
  const out: Sessione[] = [];
  const dir = path.join(home, ".cursor", "projects");
  for (const file of trovaFile(dir, (n) => n.endsWith(".jsonl"), errori)) {
    const parti = file.slice(dir.length + 1).split("/");
    const i = parti.lastIndexOf("agent-transcripts");
    if (i < 0 || !UUID.test(parti[i + 1] ?? "") || parti.length !== i + 3 || path.basename(parti[i + 2], ".jsonl") !== parti[i + 1]) continue;
    try {
      const st = fs.statSync(file);
      const { testa } = testaECoda(file, st.size);
      const primo = testa.find((o) => o.role === "user")?.message?.content;
      const testo = (Array.isArray(primo) ? primo.map((b: any) => b?.text ?? "").join("") : String(primo ?? "")).replace(/<\/?user_query>/g, "").trim();
      const cartella = parti[0]; // shortcut: la cartella è codificata con '-' al posto di '/', non si risale al percorso vero
      out.push({
        ...base(), id: parti[i + 1], sorgente: "cursor", account: "cursor", titolo: testo.slice(0, 200),
        progetto: cartella, cartella, ultimaAttivita: st.mtimeMs, file,
      });
    } catch (e: any) {
      errori.push({ percorso: file, messaggio: msgErrore(e) });
    }
  }
  return out;
}
