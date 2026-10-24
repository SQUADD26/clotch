// Dati finti grandi per le prove di prestazioni (#486): creati dal test in una cartella temporanea, mai dati veri.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const U = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
export const casa = (nome: string) => fs.mkdtempSync(path.join(os.tmpdir(), `budget-${nome}-`));
export const tempo = (f: () => unknown) => { const t = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t) / 1e6; };
export const tempoAsync = async (f: () => Promise<unknown>) => { const t = process.hrtime.bigint(); await f(); return Number(process.hrtime.bigint() - t) / 1e6; };
export const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
/** Heap vivo in MB dopo una raccolta (serve `--expose-gc`); senza, 0 e il tetto di memoria non misura. */
export const heapMB = () => { (globalThis as any).gc?.(); return process.memoryUsage().heapUsed / 1048576; };

const adesso = Date.now();
const iso = (n: number) => new Date(adesso - 60_000 * (1000 - (n % 1000))).toISOString();
const PAROLE = "il nodo legge la sessione e scrive nel registro poi controlla la cartella dell account prima di mostrare la riga nella lista".split(" ");
const testo = (n: number, parole = 40) => Array.from({ length: parole }, (_, i) => PAROLE[(n + i * 7) % PAROLE.length]).join(" ");

/** Una coppia utente/assistente (due righe JSONL, chiuse da a capo); `k` rende uniche le identità. */
export function coppia(sessione: string, k: number, parole = 40): string {
  const u = { type: "user", sessionId: sessione, cwd: "/Users/x/p", message: { role: "user", content: testo(k, parole) }, timestamp: iso(k) };
  const a = { type: "assistant", requestId: `req-${sessione.slice(0, 8)}-${k}`, message: { id: `msg-${sessione.slice(0, 8)}-${k}`, role: "assistant",
    content: [{ type: "text", text: testo(k + 3, parole) }], usage: { input_tokens: 120, output_tokens: 80, cache_creation_input_tokens: 10 } }, timestamp: iso(k + 1) };
  return JSON.stringify(u) + "\n" + JSON.stringify(a) + "\n";
}

/** `account` cartelle `.claude*` in `h`; la prima ha `projects/` con `n` sessioni (`perCartella` per progetto), le altre la linkano come sul Mac di Roberto. */
export function creaSessioni(h: string, n: number, opz: { account?: number; perCartella?: number; coppie?: number } = {}): { progetti: string; file: string[] } {
  const { account = 3, perCartella = 20, coppie = 2 } = opz;
  const progetti = path.join(h, ".claude", "projects"), file: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = path.join(progetti, `-Users-x-p${Math.floor(i / perCartella)}`);
    if (i % perCartella === 0) fs.mkdirSync(d, { recursive: true });
    const id = U(i), f = path.join(d, `${id}.jsonl`);
    fs.writeFileSync(f, Array.from({ length: coppie }, (_, k) => coppia(id, k)).join(""));
    file.push(f);
  }
  for (let a = 0; a < account; a++) {
    const r = a ? path.join(h, `.claude-${a}`) : path.join(h, ".claude");
    fs.mkdirSync(r, { recursive: true });
    fs.writeFileSync(path.join(r, ".claude.json"), JSON.stringify({ oauthAccount: { emailAddress: `utente${a}@esempio.it` } }));
    if (a) fs.symlinkSync(progetti, path.join(r, "projects"));
  }
  return { progetti, file };
}

/** Un transcript di circa `mb` MB, scritto a pezzi (non tiene tutto in memoria). */
export function transcriptGrande(file: string, mb: number, sessione = U(999_999)) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, "w");
  try {
    let scritti = 0;
    for (let k = 0; scritti < mb * 1048576; k += 64) {
      const blocco = Array.from({ length: 64 }, (_, i) => coppia(sessione, k + i, 120)).join("");
      scritti += fs.writeSync(fd, blocco);
    }
  } finally { fs.closeSync(fd); }
}

/** Una riga di registro v1 (contratto di clotch-ai.ts). */
export const rigaRegistro = (n: number, giorno = "2026-10-24") =>
  JSON.stringify({ v: 1, id: `r-${n.toString(16).padStart(12, "0")}`, t: `${giorno}T08:00:00Z`, n, chat: `c${n % 700}`, tipo: "battito", dati: { stato: "lavora" } }) + "\n";

/** Registro di `mesi` mesi, ognuno con `mb` MB di battiti. Torna il file dell'ultimo mese e il numero dell'ultima riga. */
export function creaRegistro(h: string, mesi: number, mb: number): { file: string; ultimo: number } {
  const dir = path.join(h, ".claude", "registro");
  fs.mkdirSync(dir, { recursive: true });
  let n = 0, file = "";
  for (let m = 0; m < mesi; m++) {
    file = path.join(dir, `2026-${String(m + 1).padStart(2, "0")}.jsonl`);
    const righe: string[] = [];
    for (let b = 0; b < mb * 1e6; ) { const r = rigaRegistro(++n); righe.push(r); b += r.length; }
    fs.writeFileSync(file, righe.join(""));
  }
  return { file, ultimo: n };
}
