// Trascrizioni Claude Code: <radice>/projects/**/*.jsonl per ogni radice ~/.claude e ~/.claude-*.
import * as fs from "node:fs";
import * as path from "node:path";
import { testaECoda, msgErrore } from "./jsonl";
import { aMillisecondi } from "./registri";
import { Radice } from "./radici";
import { ErroreLettura, Sessione } from "./tipi";

const cache = new Map<string, { chiave: string; s: Sessione | null }>();

/** Ultimo pezzo della cartella: il nome del progetto. */
export const nomeProgetto = (cartella: string) => path.basename(cartella.replace(/\/+$/, "")) || cartella;

function daFile(file: string, radice: Radice, size: number, mtime: number): Sessione | null {
  const { testa, coda } = testaECoda(file, size);
  const primo = testa.find((o) => typeof o.cwd === "string");
  const ultimo = [...coda].reverse().find((o) => typeof o.cwd === "string") ?? primo;
  if (!primo) return null; // solo righe di servizio: non è una sessione di lavoro
  const titolo =
    [...coda].reverse().find((o) => o.type === "ai-title" && o.aiTitle)?.aiTitle ??
    [...coda].reverse().find((o) => o.type === "custom-title" && o.customTitle)?.customTitle ??
    [...coda].reverse().find((o) => o.type === "last-prompt" && o.lastPrompt)?.lastPrompt ??
    testa.find((o) => o.type === "user" && typeof o.message?.content === "string")?.message.content ??
    "";
  const modello = [...coda].reverse().find((o) => o.type === "assistant" && o.message?.model)?.message.model ?? null;
  const t = [...coda].reverse().map((o) => aMillisecondi(o.timestamp)).find((x) => x !== null) ?? mtime;
  const cartella = ultimo.cwd as string;
  return {
    id: path.basename(file, ".jsonl"),
    sorgente: "claude-code",
    account: radice.account,
    email: radice.email,
    idApp: null,
    titolo: String(titolo).slice(0, 200),
    progetto: nomeProgetto(cartella),
    cartella,
    ramo: ultimo.gitBranch || null,
    modello,
    stato: "ferma", // lo stato vero lo mette elenco.ts
    perche: null,
    ultimaAttivita: Math.max(t, 0),
    obiettivo: null,
    file,
  };
}

export function leggiRadice(radice: Radice, errori: ErroreLettura[]): Sessione[] {
  const progetti = path.join(radice.path, "projects");
  let cartelle: string[];
  try {
    cartelle = fs.readdirSync(progetti);
  } catch (e: any) {
    if (e.code !== "ENOENT") errori.push({ percorso: progetti, messaggio: msgErrore(e) });
    return [];
  }
  const out: Sessione[] = [];
  for (const c of cartelle) {
    let files: string[];
    try {
      files = fs.readdirSync(path.join(progetti, c)).filter((n) => n.endsWith(".jsonl"));
    } catch (e: any) {
      errori.push({ percorso: path.join(progetti, c), messaggio: msgErrore(e) });
      continue;
    }
    for (const n of files) {
      const file = path.join(progetti, c, n);
      try {
        const st = fs.statSync(file);
        const chiave = `${st.mtimeMs}:${st.size}`;
        let e = cache.get(file);
        if (!e || e.chiave !== chiave) {
          e = { chiave, s: daFile(file, radice, st.size, st.mtimeMs) };
          cache.set(file, e);
        }
        if (e.s) out.push({ ...e.s });
      } catch (err: any) {
        errori.push({ percorso: file, messaggio: msgErrore(err) });
      }
    }
  }
  return out;
}
