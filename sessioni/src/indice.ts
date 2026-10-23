// Indice di ricerca delle sessioni (#368): uno solo, nel main, con la sua cache in userData/indice.json. Per sessione
// il testo di utente e assistente con il suo tempo (niente strumenti, niente pensieri) e il numero dei messaggi.
// Si rilegge solo il file che ha cambiato mtime o dimensione, una sessione per giro del ciclo: la finestra non si blocca.
import * as fs from "node:fs";
import * as path from "node:path";
import { parseRiga, righeIn } from "./jsonl";
import { nuovoConvertitore } from "./messaggi";
import type { RisultatoRicerca, Sessione } from "./tipi";

export interface Voce { file: string; mtime: number; size: number; titolo: string; conteggio: number; testi: { testo: string; t: number | null }[] }
export type DatiIndice = Record<string, Voce>;
export type DaIndicizzare = Pick<Sessione, "id" | "file" | "sorgente" | "titolo">;

/** File mancante o rotto = indice vuoto: è una cache, si ricostruisce. */
export function leggiIndice(file: string): DatiIndice {
  try {
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    return d && typeof d === "object" && !Array.isArray(d) ? d : {};
  } catch { return {}; }
}

/** Rilegge tutta la trascrizione solo se mtime o dimensione sono cambiati. Vero se la voce è cambiata. */
export function aggiornaVoce(d: DatiIndice, s: DaIndicizzare): boolean {
  const v = d[s.id];
  let st: fs.Stats;
  try { st = fs.statSync(s.file); } catch { delete d[s.id]; return !!v; } // file sparito
  if (v && v.file === s.file && v.mtime === st.mtimeMs && v.size === st.size) {
    if (v.titolo === s.titolo) return false;
    v.titolo = s.titolo;
    return true;
  }
  const testi: Voce["testi"] = [];
  let conteggio = 0;
  if (s.file.endsWith(".jsonl")) {
    const c = nuovoConvertitore(s);
    for (const r of righeIn(s.file, 0, st.size)) {
      const o = parseRiga(r);
      for (const m of o ? c.riga(o).nuovi : []) {
        conteggio++;
        if (m.tipo === "utente" || m.tipo === "assistente") testi.push({ testo: m.testo, t: m.t });
      }
    }
  }
  d[s.id] = { file: s.file, mtime: st.mtimeMs, size: st.size, titolo: s.titolo, conteggio, testi };
  return true;
}

const frammento = (s: string, i: number, n: number) => {
  const da = Math.max(0, i - 40), a = Math.min(s.length, i + n + 80);
  return (da > 0 ? "…" : "") + s.slice(da, a).replace(/\s+/g, " ").trim() + (a < s.length ? "…" : "");
};

/** Una riga per sessione (l'ultimo messaggio che contiene il testo), senza maiuscole; prima chi ce l'ha nel titolo, poi i più recenti. */
export function cerca(d: DatiIndice, testo: string, max = 50): RisultatoRicerca[] {
  // shortcut: scorre tutto il testo a ogni ricerca; se diventa lenta con molte sessioni, un indice di parole.
  const q = testo.trim().toLowerCase();
  if (!q) return [];
  const out: (RisultatoRicerca & { quando: number })[] = [];
  for (const [id, v] of Object.entries(d)) {
    const nelTitolo = v.titolo.toLowerCase().includes(q);
    let m: Voce["testi"][number] | undefined, i = -1;
    for (let k = v.testi.length - 1; k >= 0 && i < 0; k--) if ((i = v.testi[k].testo.toLowerCase().indexOf(q)) >= 0) m = v.testi[k];
    if (!nelTitolo && !m) continue;
    out.push({ id, titolo: v.titolo, frammento: m ? frammento(m.testo, i, q.length) : v.titolo, t: m?.t ?? null, nelTitolo, quando: m?.t ?? v.mtime });
  }
  out.sort((a, b) => Number(b.nelTitolo) - Number(a.nelTitolo) || b.quando - a.quando);
  return out.slice(0, max).map(({ quando: _, ...r }) => r);
}

const dimensione = (p: string): number => {
  try {
    const st = fs.lstatSync(p);
    return st.isDirectory() ? fs.readdirSync(p).reduce((n, x) => n + dimensione(path.join(p, x)), 0) : st.size;
  } catch { return 0; }
};

export class Indice {
  dati: DatiIndice;
  private coda = new Map<string, DaIndicizzare>();
  private attese: (() => void)[] = [];
  private inGiro = false;
  private scrittura: NodeJS.Timeout | null = null;
  readonly file: string;
  // cache/messaggi e cache/immagini non esistono ancora: le useranno i pezzi che terranno messaggi o immagini sul disco
  private readonly cache: string[];

  constructor(private dir: string, private attesaScritturaMs = 2000) {
    this.file = path.join(dir, "indice.json");
    this.cache = [path.join(dir, "cache", "messaggi"), path.join(dir, "cache", "immagini")];
    this.dati = leggiIndice(this.file);
  }

  /** Mette in coda le sessioni da controllare; `tutte` = sono tutte le sessioni, le altre escono dall'indice. Si risolve a coda vuota. */
  metti(sessioni: DaIndicizzare[], tutte = false): Promise<void> {
    if (tutte) {
      const ids = new Set(sessioni.map((s) => s.id));
      for (const id of Object.keys(this.dati)) if (!ids.has(id)) { delete this.dati[id]; this.daScrivere(); }
    }
    for (const s of sessioni) this.coda.set(s.id, s);
    const p = new Promise<void>((ok) => this.attese.push(ok));
    if (!this.inGiro) { this.inGiro = true; setImmediate(() => this.passo()); }
    return p;
  }

  private passo() {
    const s = this.coda.values().next().value;
    if (!s) { this.inGiro = false; this.attese.splice(0).forEach((ok) => ok()); return; }
    this.coda.delete(s.id);
    try { if (aggiornaVoce(this.dati, s)) this.daScrivere(); } catch { /* file illeggibile: resta la voce di prima */ }
    setImmediate(() => this.passo());
  }

  private daScrivere() {
    this.scrittura ??= setTimeout(() => { this.scrittura = null; this.scrivi(); }, this.attesaScritturaMs);
    this.scrittura.unref?.();
  }

  /** Scrittura atomica (.tmp poi rename), come le preferenze. */
  scrivi() {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(`${this.file}.tmp`, JSON.stringify(this.dati));
    fs.renameSync(`${this.file}.tmp`, this.file);
  }

  ricostruisci(sessioni: DaIndicizzare[]): Promise<void> {
    this.dati = {};
    this.coda.clear();
    return this.metti(sessioni, true);
  }

  /** Toglie indice.json e le cartelle di cache, solo dentro la cartella dell'app. */
  svuota() {
    this.coda.clear();
    if (this.scrittura) clearTimeout(this.scrittura);
    this.scrittura = null;
    this.dati = {};
    for (const p of [this.file, ...this.cache]) fs.rmSync(p, { recursive: true, force: true });
  }

  cerca(testo: string) { return cerca(this.dati, testo); }

  /** Byte su disco: l'indice, le due cartelle di cache (0 se mancano) e `altro`, il resto della cartella dell'app. */
  spazio() {
    const indice = dimensione(this.file), messaggi = dimensione(this.cache[0]), immagini = dimensione(this.cache[1]);
    return { indice, messaggi, immagini, altro: Math.max(0, dimensione(this.dir) - indice - messaggi - immagini) };
  }

  /** Numero dei messaggi se l'indice conosce la trascrizione così com'è adesso; altrimenti null. */
  totale(id: string): number | null {
    const v = this.dati[id];
    if (!v || !v.file.endsWith(".jsonl")) return null;
    try {
      const st = fs.statSync(v.file);
      return st.mtimeMs === v.mtime && st.size === v.size ? v.conteggio : null;
    } catch { return null; }
  }
}
