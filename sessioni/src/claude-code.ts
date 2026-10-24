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

/** Ultima lettura per cartella `projects`, sottocartella per sottocartella (file e sessioni della cache, mai modificate):
 * un giro rilegge solo le sottocartelle toccate, il resto si riusa senza readdir, stat né scorrere la cache (#474). */
type Cartella = { file: string[]; sessioni: Sessione[] };
const ultimi = new Map<string, { radice: string; cartelle: Map<string, Cartella> }>();

/** `<radice>/projects`, o la cartella vera se è un link: più account con `projects` linkata alla stessa cartella la leggono e la guardano una volta (#474). */
export function progettiDi(radice: string): string {
  const p = path.join(radice, "projects");
  try { return fs.lstatSync(p).isSymbolicLink() ? fs.realpathSync(p) : p; } catch { return p; }
}

/** Chi è davvero una cartella (realpath): due nomi della stessa cartella danno la stessa chiave. */
export const chiaveCartella = (p: string) => { try { return fs.realpathSync(p); } catch { return p; } };

/** `f` (un percorso cambiato secondo fs.watch) tocca `x`: è x, o una cartella che lo contiene. */
export const tocca = (f: string, x: string) => f === x || x.startsWith(f + path.sep);

/** Qualcosa in `sporchi` tocca `x` o sta dentro `x`. */
export const toccata = (sporchi: string[], x: string) => sporchi.some((f) => tocca(f, x) || f.startsWith(x + path.sep));
const copie = (u: Map<string, Cartella>) => [...u.values()].flatMap((c) => c.sessioni.map((s) => ({ ...s })));

/** `sporchi`: i percorsi cambiati dall'ultimo giro (fs.watch). Senza, si rilegge tutto; con, cartelle e file non toccati vengono dall'ultima lettura. */
export function leggiRadice(radice: Radice, errori: ErroreLettura[], sporchi?: string[]): Sessione[] {
  const progetti = progettiDi(radice.path), firmaRadice = `${radice.account}\0${radice.email}`;
  const u = sporchi && ultimi.get(progetti)?.radice === firmaRadice ? ultimi.get(progetti)!.cartelle : undefined;
  if (u && !toccata(sporchi!, progetti)) return copie(u);
  ultimi.delete(progetti);
  let nomi: string[];
  try {
    nomi = fs.readdirSync(progetti);
  } catch (e: any) {
    sfoltisci(progetti, new Set());
    if (e.code !== "ENOENT") errori.push({ percorso: progetti, messaggio: msgErrore(e) });
    else ultimi.set(progetti, { radice: firmaRadice, cartelle: new Map() }); // radice senza progetti: il giro dopo non riscorre la cache
    return [];
  }
  const erroriPrima = errori.length, cartelle = new Map<string, Cartella>();
  for (const c of nomi) {
    const dir = path.join(progetti, c), prima = u?.get(dir);
    if (prima && !toccata(sporchi!, dir)) { cartelle.set(dir, prima); continue; }
    let files: string[];
    try {
      files = fs.readdirSync(dir).filter((n) => n.endsWith(".jsonl")).map((n) => path.join(dir, n));
    } catch (e: any) {
      errori.push({ percorso: dir, messaggio: msgErrore(e) });
      continue;
    }
    const sessioni: Sessione[] = [];
    for (const file of files) {
      try {
        let e = cache.get(file);
        if (!e || !u || sporchi!.some((f) => tocca(f, file))) {
          const st = fs.statSync(file);
          const chiave = `${st.ino}:${st.mtimeMs}:${st.ctimeMs}:${st.size}`; // come altre-sorgenti.ts: riscritto a pari mtime e misura = riletto
          if (!e || e.chiave !== chiave) cache.set(file, e = { chiave, s: daFile(file, radice, st.size, st.mtimeMs) });
        }
        if (e.s) sessioni.push(e.s);
      } catch (err: any) {
        errori.push({ percorso: file, messaggio: msgErrore(err) });
      }
    }
    if (prima) { const ora = new Set(files); for (const f of prima.file) if (!ora.has(f)) cache.delete(f); } // spariti da questa cartella
    cartelle.set(dir, { file: files, sessioni });
  }
  if (u) { for (const [d, c] of u) if (!cartelle.has(d)) c.file.forEach((f) => cache.delete(f)); } // cartelle sparite
  else sfoltisci(progetti, new Set([...cartelle.values()].flatMap((c) => c.file)));
  if (errori.length === erroriPrima) ultimi.set(progetti, { radice: firmaRadice, cartelle }); // con errori si riprova al prossimo giro
  return copie(cartelle);
}
