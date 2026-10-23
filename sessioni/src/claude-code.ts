// Trascrizioni Claude Code: <radice>/projects/**/*.jsonl per ogni radice ~/.claude e ~/.claude-*.
import * as fs from "node:fs";
import * as path from "node:path";
import { testaECoda, msgErrore } from "./jsonl";
import { aMillisecondi } from "./registri";
import { Radice } from "./radici";
import { situazioneClaude } from "./situazione";
import { ErroreLettura, Sessione } from "./tipi";

type Voci = Map<string, { chiave: string; s: Sessione | null }>;
/** Per radice, e rifatta a ogni giro: un file sparito esce dalla cache. */
const cache = new Map<string, Voci>();

/** Ultimo pezzo della cartella: il nome del progetto. */
export const nomeProgetto = (cartella: string) => path.basename(cartella.replace(/\/+$/, "")) || cartella;

const testo = (x: unknown) => (typeof x === "string" ? x : "");
/** Testo di un messaggio utente: stringa o blocchi `text`. */
const testoUtente = (c: unknown) => (Array.isArray(c) ? c.map((b: any) => (b?.type === "text" ? testo(b.text) : "")).join("") : testo(c));

function daFile(file: string, radice: Radice, size: number, mtime: number): Sessione | null {
  const { testa, coda } = testaECoda(file, size);
  const dietro = [...coda].reverse();
  const conCwd = (o: any) => typeof o.cwd === "string";
  const ultimo = dietro.find(conCwd) ?? testa.find(conCwd); // la prima riga può superare la testa letta (testo incollato): la coda basta
  if (!ultimo) return null; // solo righe di servizio: non è una sessione di lavoro
  const campo = (tipo: string, nome: string) => dietro.find((o) => o.type === tipo && testo(o[nome]))?.[nome] as string | undefined;
  const titolo =
    campo("ai-title", "aiTitle") ?? campo("custom-title", "customTitle") ?? campo("last-prompt", "lastPrompt") ??
    testa.map((o) => (o.type === "user" ? testoUtente(o.message?.content) : "")).find(Boolean) ?? "";
  const modello = dietro.find((o) => o.type === "assistant" && testo(o.message?.model))?.message.model ?? null;
  const t = dietro.map((o) => aMillisecondi(o.timestamp)).find((x) => x !== null) ?? mtime;
  const cartella = ultimo.cwd as string;
  return {
    id: path.basename(file, ".jsonl"),
    sorgente: "claude-code",
    account: radice.account,
    email: radice.email,
    idApp: null,
    titolo: titolo.slice(0, 200),
    progetto: nomeProgetto(cartella),
    cartella,
    ramo: testo(ultimo.gitBranch) || null,
    modello,
    stato: "ferma", // lo stato vero lo mette elenco.ts
    perche: null,
    ultimaAttivita: Math.max(t, 0),
    obiettivo: null,
    situazione: situazioneClaude(coda),
    file,
  };
}

export function leggiRadice(radice: Radice, errori: ErroreLettura[]): Sessione[] {
  const progetti = path.join(radice.path, "projects");
  let cartelle: string[];
  try {
    cartelle = fs.readdirSync(progetti);
  } catch (e: any) {
    cache.delete(radice.path);
    if (e.code !== "ENOENT") errori.push({ percorso: progetti, messaggio: msgErrore(e) });
    return [];
  }
  const prima = cache.get(radice.path), nuova: Voci = new Map(), out: Sessione[] = [];
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
        const chiave = `${st.ino}:${st.mtimeMs}:${st.ctimeMs}:${st.size}`; // come altre-sorgenti.ts: riscritto a pari mtime e misura = riletto
        let e = prima?.get(file);
        if (!e || e.chiave !== chiave) e = { chiave, s: daFile(file, radice, st.size, st.mtimeMs) };
        nuova.set(file, e);
        if (e.s) out.push({ ...e.s });
      } catch (err: any) {
        errori.push({ percorso: file, messaggio: msgErrore(err) });
      }
    }
  }
  cache.set(radice.path, nuova);
  return out;
}
