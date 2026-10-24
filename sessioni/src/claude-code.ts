// Trascrizioni Claude Code: <radice>/projects/**/*.jsonl per ogni radice ~/.claude e ~/.claude-*.
import * as fs from "node:fs";
import * as path from "node:path";
import { testaECoda, msgErrore } from "./jsonl";
import { aMillisecondi } from "./registri";
import { Radice } from "./radici";
import { situazioneClaude } from "./situazione";
import { ErroreLettura, Sessione } from "./tipi";

/** Esportata: il worker d'avvio la riempie e il main la copia (api.ts). Per file; a ogni giro quelli spariti escono (leggiRadice). */
export const cache = new Map<string, { chiave: string; s: Sessione | null }>();

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
  // shortcut: la modalità è scritta solo su alcune righe utente; se né coda né testa la hanno, resta null e la casella mostra «Chiedi approvazione»
  const conModo = (o: any) => o.type === "user" && testo(o.permissionMode);
  const permessi = (dietro.find(conModo) ?? testa.find(conModo))?.permissionMode ?? null;
  const u = dietro.find((o) => o.type === "assistant" && o.message?.usage)?.message.usage;
  const contesto = u ? (Number(u.input_tokens) || 0) + (Number(u.cache_read_input_tokens) || 0) + (Number(u.cache_creation_input_tokens) || 0) : null;
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
    permessi,
    contesto,
    stato: "ferma", // lo stato vero lo mette elenco.ts
    perche: null,
    ultimaAttivita: Math.max(t, 0),
    obiettivo: null,
    situazione: situazioneClaude(coda),
    file,
  };
}

/** Un file sparito esce dalla cache (era per radice: ora per file, perché il worker d'avvio la copia così). */
function sfoltisci(progetti: string, viste: Set<string>) {
  for (const k of cache.keys()) if (k.startsWith(progetti + path.sep) && !viste.has(k)) cache.delete(k);
}

/** `f` (un percorso cambiato secondo fs.watch) tocca `x`: è x, o una cartella che lo contiene. */
/** Ultimo risultato per cartella `projects` (sessioni della cache, mai modificate): un giro che non la tocca lo riusa senza ciclo sui file. */
const ultimi = new Map<string, { radice: string; sessioni: Sessione[] }>();

export const tocca = (f: string, x: string) => f === x || x.startsWith(f + path.sep);

/** `sporchi`: i percorsi cambiati dall'ultimo giro (fs.watch). Senza, si rilegge tutto; con, cartelle e file non toccati vengono dalla cache, senza readdir né stat. */
export function leggiRadice(radice: Radice, errori: ErroreLettura[], sporchi?: string[]): Sessione[] {
  const progetti = path.join(radice.path, "projects"), firmaRadice = `${radice.account}\0${radice.email}`;
  const u = sporchi && ultimi.get(progetti);
  if (u && u.radice === firmaRadice && !sporchi.some((f) => tocca(f, progetti) || f.startsWith(progetti + path.sep))) return u.sessioni.map((s) => ({ ...s }));
  ultimi.delete(progetti);
  let cartelle: string[];
  try {
    cartelle = fs.readdirSync(progetti);
  } catch (e: any) {
    sfoltisci(progetti, new Set());
    if (e.code !== "ENOENT") errori.push({ percorso: progetti, messaggio: msgErrore(e) });
    else ultimi.set(progetti, { radice: firmaRadice, sessioni: [] }); // radice senza progetti: il giro dopo non riscorre la cache
    return [];
  }
  const viste = new Set<string>(), base: Sessione[] = [], erroriPrima = errori.length;
  const noti = new Map<string, string[]>(); // cartella -> nomi dei file già in cache
  if (sporchi) for (const k of cache.keys()) if (k.startsWith(progetti + path.sep)) {
    const d = path.dirname(k), l = noti.get(d);
    if (l) l.push(path.basename(k)); else noti.set(d, [path.basename(k)]);
  }
  for (const c of cartelle) {
    const dir = path.join(progetti, c);
    let files: string[];
    try {
      const n = noti.get(dir);
      files = n && !sporchi!.some((f) => tocca(f, dir) || f.startsWith(dir + path.sep)) ? n
        : fs.readdirSync(dir).filter((n) => n.endsWith(".jsonl"));
    } catch (e: any) {
      errori.push({ percorso: path.join(progetti, c), messaggio: msgErrore(e) });
      continue;
    }
    for (const n of files) {
      const file = path.join(progetti, c, n);
      try {
        const nota = sporchi && cache.get(file);
        if (nota && !sporchi.some((f) => tocca(f, file))) {
          viste.add(file);
          if (nota.s) base.push(nota.s);
          continue;
        }
        const st = fs.statSync(file);
        const chiave = `${st.ino}:${st.mtimeMs}:${st.ctimeMs}:${st.size}`; // come altre-sorgenti.ts: riscritto a pari mtime e misura = riletto
        let e = cache.get(file);
        if (!e || e.chiave !== chiave) {
          e = { chiave, s: daFile(file, radice, st.size, st.mtimeMs) };
          cache.set(file, e);
        }
        viste.add(file);
        if (e.s) base.push(e.s);
      } catch (err: any) {
        errori.push({ percorso: file, messaggio: msgErrore(err) });
      }
    }
  }
  sfoltisci(progetti, viste);
  if (errori.length === erroriPrima) ultimi.set(progetti, { radice: firmaRadice, sessioni: base }); // con errori si riprova al prossimo giro
  return base.map((s) => ({ ...s }));
}
