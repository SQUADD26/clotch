// Dati veri per i menu della casella (#437, frame 101:26745 e 101:27018): comandi con «/» letti dal disco e file con «@» della cartella della sessione.
import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import type { VoceComando } from "./tipi";

/** I comandi di Claude Code che ci sono sempre, con la descrizione nella lingua dell'app. */
export const COMANDI_BASE: VoceComando[] = ([
  ["clear", "Svuota la conversazione e riparte da zero"], ["compact", "Riassume la conversazione per fare spazio"],
  ["context", "Mostra quanto contesto è usato"], ["cost", "Mostra il consumo della sessione"], ["model", "Cambia il modello della sessione"],
  ["init", "Crea il file CLAUDE.md del progetto"], ["memory", "Modifica i file di memoria"], ["resume", "Riprende una conversazione"],
  ["review", "Rivede una pull request"], ["status", "Mostra lo stato della sessione"], ["config", "Apre le impostazioni di Claude Code"],
  ["agents", "Gestisce gli aiutanti"], ["mcp", "Gestisce i connettori"], ["permissions", "Cambia i permessi"], ["help", "Mostra l'aiuto"],
] as const).map(([n, descrizione]) => ({ nome: `/${n}`, descrizione, gruppo: "Comandi" }));

/** `description` dall'intestazione `---` di un file di comando o di skill; senza, la prima riga di testo. */
export function descrizioneDi(testo: string): string {
  const righe = testo.split("\n");
  const primaRiga = (da: string[]) => (da.find((r) => r.trim()) ?? "").replace(/^#+\s*/, "").trim().slice(0, 120);
  if (righe[0]?.trim() !== "---") return primaRiga(righe);
  const fine = righe.indexOf("---", 1);
  const i = righe.slice(1, fine < 0 ? undefined : fine).findIndex((r) => /^description:/.test(r)) + 1;
  if (!i) return primaRiga(righe.slice(fine + 1));
  let v = righe[i].replace(/^description:\s*/, "").trim();
  if (/^[>|][+-]?$/.test(v)) v = (righe[i + 1] ?? "").trim(); // testo a capo: basta la prima riga
  return v.replace(/^["']|["']$/g, "").slice(0, 120);
}

const leggi = (f: string) => { try { return fs.readFileSync(f, "utf8"); } catch { return null; } };
const elenca = (d: string) => { try { return fs.readdirSync(d); } catch { return []; } };

/** Comandi veri di una sessione: quelli di base, poi `commands/*.md` e `skills/<nome>/SKILL.md` dell'account e del progetto. */
export function comandiDi(radiceAccount: string | null, cartella: string): VoceComando[] {
  const radici = [...(radiceAccount ? [radiceAccount] : []), ...(cartella ? [path.join(cartella, ".claude")] : [])];
  const visti = new Set(COMANDI_BASE.map((c) => c.nome));
  const out = [...COMANDI_BASE];
  const aggiungi = (nome: string, testo: string | null, gruppo: VoceComando["gruppo"]) => {
    if (testo === null || visti.has(`/${nome}`)) return;
    visti.add(`/${nome}`);
    out.push({ nome: `/${nome}`, descrizione: descrizioneDi(testo), gruppo });
  };
  for (const r of radici) for (const f of elenca(path.join(r, "commands")).filter((n) => n.endsWith(".md")).sort())
    aggiungi(f.slice(0, -3), leggi(path.join(r, "commands", f)), "Comandi");
  for (const r of radici) for (const d of elenca(path.join(r, "skills")).sort())
    aggiungi(d, leggi(path.join(r, "skills", d, "SKILL.md")), "Skill");
  return out;
}

const SALTA = new Set(["node_modules", ".git", "dist", "build", ".next", "target"]);
/** Fuori da git: giro delle cartelle, senza quelle nascoste né le pesanti. shortcut: al massimo 5000 file e 6 livelli, poi si ferma. */
function giro(radice: string): string[] {
  const out: string[] = [];
  const vai = (rel: string, livello: number) => {
    if (livello > 6 || out.length >= 5000) return;
    for (const e of fs.readdirSync(path.join(radice, rel), { withFileTypes: true })) {
      if (e.name.startsWith(".") || SALTA.has(e.name)) continue;
      const p = path.join(rel, e.name);
      if (e.isDirectory()) { try { vai(p, livello + 1); } catch { /* cartella illeggibile: si salta */ } } else if (e.isFile()) out.push(p);
    }
  };
  vai("", 0);
  return out;
}

const cache = new Map<string, { t: number; file: Promise<string[]> }>();
/** Tutti i file della cartella (git prima, così `.gitignore` conta), ricordati 5 s per non rifarli a ogni tasto. */
function tutti(cartella: string): Promise<string[]> {
  const c = cache.get(cartella);
  if (c && Date.now() - c.t < 5000) return c.file;
  const file = new Promise<string[]>((ok) =>
    execFile("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: cartella, maxBuffer: 32 << 20 }, (e, out) => {
      if (!e) return ok(out.split("\0").filter(Boolean));
      try { ok(giro(cartella)); } catch { ok([]); }
    }));
  cache.set(cartella, { t: Date.now(), file });
  return file;
}

/** I file che contengono `testo` nel percorso: prima chi inizia col testo nel nome, poi chi lo ha nel nome, poi nel percorso. */
export async function cercaFile(cartella: string, testo: string, limite = 8): Promise<string[]> {
  if (!cartella || !fs.existsSync(cartella)) return [];
  const t = testo.toLowerCase();
  const voti = (f: string) => { const n = path.basename(f).toLowerCase(); return n.startsWith(t) ? 0 : n.includes(t) ? 1 : 2; };
  return (await tutti(cartella)).filter((f) => f.toLowerCase().includes(t))
    .sort((a, b) => voti(a) - voti(b) || path.basename(a).length - path.basename(b).length || a.length - b.length || a.localeCompare(b)).slice(0, limite);
}
