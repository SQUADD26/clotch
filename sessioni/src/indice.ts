// Indice di ricerca delle sessioni (#368): uno solo, nel main, con la sua cache in userData/indice/ (un file per sessione, #474). Per sessione
// il testo di utente e assistente con il suo tempo (niente strumenti, niente pensieri) e il numero dei messaggi.
// Si rilegge solo il file che ha cambiato mtime o dimensione, una sessione per giro del ciclo: la finestra non si blocca.
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { leggiBlocco, parseRiga } from "./jsonl";
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

/** Come riprendere una trascrizione che è solo cresciuta: dove sono arrivato, con la memoria del convertitore. Solo in memoria. */
interface Memo { file: string; ino: number; fine: number; conteggio: number; nTesti: number; firma: string; conv: ReturnType<typeof nuovoConvertitore> }
export type MemoIndice = Map<string, Memo>;
const MAX_MEMO = 32; // il convertitore tiene le chiamate senza esito: poche sessioni, le ultime toccate
const FINESTRA = 16 * 1024;

// shortcut: si presume che una trascrizione cresca solo in coda; lo controlla il hash di testa e degli ultimi 16 KB prima del punto di ripresa,
// non tutto il prefisso (costerebbe O(dimensione) a ogni append). Un file riscritto nel mezzo senza cambiare né testa né coda arriva fino alla ricostruzione.
function firma(file: string, fine: number, buf?: Buffer): string {
  const blocco = (da: number, a: number) => (buf && a <= buf.length ? buf.subarray(da, a) : leggiByte(file, da, a)); // `buf` = i byte da 0 in poi, se già letti
  return createHash("md5").update(blocco(0, Math.min(fine, FINESTRA))).update("|").update(blocco(Math.max(0, fine - FINESTRA), fine)).digest("hex");
}

function leggiByte(file: string, da: number, a: number): Buffer {
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(a - da);
    return buf.subarray(0, fs.readSync(fd, buf, 0, buf.length, da));
  } finally { fs.closeSync(fd); }
}

/**
 * Rilegge la trascrizione solo se mtime o dimensione sono cambiati: spostata senza cambiare contenuto, aggiorna solo il percorso;
 * cresciuta in coda (con `memo`), legge solo le righe nuove. Vero se la voce è cambiata.
 */
export function aggiornaVoce(d: DatiIndice, s: DaIndicizzare, memo?: MemoIndice): boolean {
  const v = d[s.id];
  let st: fs.Stats;
  try { st = fs.statSync(s.file); } catch { delete d[s.id]; memo?.delete(s.id); return !!v; } // file sparito
  if (v && v.mtime === st.mtimeMs && v.size === st.size) {
    if (v.file === s.file && v.titolo === s.titolo) return false;
    v.file = s.file; // `mv` tra due account tiene mtime e dimensione: il contenuto è quello
    v.titolo = s.titolo;
    const m = memo?.get(s.id);
    if (m) m.file = s.file;
    return true;
  }
  let testi: Voce["testi"] = [], conteggio = 0;
  if (s.file.endsWith(".jsonl")) {
    let m = memo?.get(s.id);
    memo?.delete(s.id);
    if (m && v && m.file === s.file && m.ino === st.ino && st.size >= m.fine && firma(s.file, m.fine) === m.firma) {
      testi = v.testi.slice(0, m.nTesti);
      conteggio = m.conteggio;
    } else m = undefined;
    const c = m?.conv ?? nuovoConvertitore(s), da = m?.fine ?? 0;
    const buf = leggiByte(s.file, da, st.size), chiuse = buf.lastIndexOf(10) + 1;
    const dentro = (r: string) => { const o = parseRiga(r); for (const x of o ? c.riga(o).nuovi : []) { conteggio++; if (x.tipo === "utente" || x.tipo === "assistente") testi.push({ testo: x.testo, t: x.t }); } };
    if (chiuse) buf.toString("utf8", 0, chiuse).split("\n").forEach(dentro);
    const base = { conteggio, nTesti: testi.length };
    if (chiuse < buf.length) dentro(buf.toString("utf8", chiuse)); // riga ancora a metà: conta se è già JSON valido, ma si riprende da prima
    if (memo) {
      memo.set(s.id, { file: s.file, ino: st.ino, fine: da + chiuse, ...base, firma: firma(s.file, da + chiuse, da ? undefined : buf), conv: c });
      if (memo.size > MAX_MEMO) memo.delete(memo.keys().next().value!);
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
    for (let k = v.testi.length - 1; k >= 0 && i < 0; k--) {
      const t = v.testi[k].testo, l = t.toLowerCase();
      // alcune maiuscole cambiano lunghezza (İ): l'indice vale per il minuscolo, che allora è il testo da ritagliare
      if ((i = l.indexOf(q)) >= 0) m = { testo: l.length === t.length ? t : l, t: v.testi[k].t };
    }
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
  private memo: MemoIndice = new Map();
  private inGiro = false;
  private scrittura: NodeJS.Timeout | null = null;
  private sporche = new Set<string>(); // sessioni da riscrivere (o togliere) al prossimo `scrivi`
  readonly file: string; // indice.json di prima di #474: si legge una volta, poi diventa la cartella
  readonly cartella: string;
  // cache/messaggi e cache/immagini non esistono ancora: le useranno i pezzi che terranno messaggi o immagini sul disco
  private readonly cache: string[];

  /** `subito` = legge l'indice dal disco ora; l'app passa false e chiama `carica()` dopo la prima finestra (#474: migliaia di file letti prima della finestra ne ritardavano l'avvio). */
  constructor(private dir: string, private attesaScritturaMs = 2000, subito = true) {
    this.file = path.join(dir, "indice.json");
    this.cartella = path.join(dir, "indice");
    this.cache = [path.join(dir, "cache", "messaggi"), path.join(dir, "cache", "immagini")];
    this.dati = {};
    if (subito) this.leggiOra();
  }

  private leggiOra() {
    let nomi: string[] | null = null;
    try { nomi = fs.readdirSync(this.cartella).filter((n) => n.endsWith(".json")); } catch { /* prima volta */ }
    for (const n of nomi ?? []) {
      try { this.dati[decodeURIComponent(n.slice(0, -5))] = JSON.parse(fs.readFileSync(path.join(this.cartella, n), "utf8")); } catch { /* voce rotta: si rilegge la trascrizione */ }
    }
    if (!nomi && fs.existsSync(this.file)) { this.dati = leggiIndice(this.file); Object.keys(this.dati).forEach((id) => this.sporche.add(id)); }
  }

  /** Come la lettura del costruttore, ma a pezzi e senza fermare il main; le voci già messe nel frattempo restano. */
  async carica(): Promise<void> {
    const letti: DatiIndice = {};
    let nomi: string[] | null = null;
    try { nomi = (await fs.promises.readdir(this.cartella)).filter((n) => n.endsWith(".json")); } catch { /* prima volta */ }
    for (let i = 0; i < (nomi?.length ?? 0); i += 64) {
      await Promise.all(nomi!.slice(i, i + 64).map(async (n) => {
        try { letti[decodeURIComponent(n.slice(0, -5))] = JSON.parse(await fs.promises.readFile(path.join(this.cartella, n), "utf8")); } catch { /* voce rotta: si rilegge la trascrizione */ }
      }));
    }
    if (!nomi) {
      try {
        const d = JSON.parse(await fs.promises.readFile(this.file, "utf8")); // shortcut: il vecchio indice.json unico (una volta sola) si analizza in un colpo
        if (d && typeof d === "object" && !Array.isArray(d)) { Object.assign(letti, d); Object.keys(d).forEach((id) => this.sporche.add(id)); }
      } catch { /* niente indice vecchio */ }
    }
    this.dati = { ...letti, ...this.dati };
  }

  /** Mette in coda le sessioni da controllare; `tutte` = sono tutte le sessioni, le altre escono dall'indice. Si risolve a coda vuota. */
  metti(sessioni: DaIndicizzare[], tutte = false): Promise<void> {
    if (tutte) {
      const ids = new Set(sessioni.map((s) => s.id));
      for (const id of Object.keys(this.dati)) if (!ids.has(id)) { delete this.dati[id]; this.memo.delete(id); this.daScrivere(id); }
    }
    for (const s of sessioni) this.coda.set(s.id, s);
    const p = new Promise<void>((ok) => this.attese.push(ok));
    if (!this.inGiro) { this.inGiro = true; setImmediate(() => this.passo()); }
    return p;
  }

  /** Rilettura delle trascrizioni cambiate fuori dal main (worker di lavori.ts); senza, qui come prima (test, elenco-cli). */
  private fuori: ((s: DaIndicizzare, v: Voce | null) => Promise<{ cambiata: boolean; v: Voce | null }>) | null = null;
  lavoraFuori(f: NonNullable<Indice["fuori"]>) { this.fuori = f; }

  private passo() {
    const s = this.coda.values().next().value;
    if (!s) { this.inGiro = false; this.attese.splice(0).forEach((ok) => ok()); return; }
    this.coda.delete(s.id);
    if (this.fuori && !this.invariata(s)) {
      this.fuori(s, this.dati[s.id] ?? null).then((r) => {
        if (!r.cambiata) return;
        if (r.v) this.dati[s.id] = r.v; else delete this.dati[s.id];
        this.daScrivere(s.id);
      }, () => { /* file illeggibile: resta la voce di prima */ }).finally(() => setImmediate(() => this.passo()));
      return;
    }
    try { if (aggiornaVoce(this.dati, s, this.memo)) this.daScrivere(s.id); } catch { /* file illeggibile: resta la voce di prima */ }
    setImmediate(() => this.passo());
  }

  /** Stessa misura e stesso mtime della voce (o file sparito): il lavoro è poco e si fa qui. */
  private invariata(s: DaIndicizzare): boolean {
    const v = this.dati[s.id];
    try { const st = fs.statSync(s.file); return !!v && v.mtime === st.mtimeMs && v.size === st.size; } catch { return true; }
  }

  private daScrivere(id: string) {
    this.sporche.add(id);
    this.scrittura ??= setTimeout(() => { this.scrittura = null; this.scrivi(); }, this.attesaScritturaMs);
    this.scrittura.unref?.();
  }

  /** Solo le sessioni cambiate, ognuna nel suo file (.tmp poi rename): riscrivere tutto l'indice (95 MB) bloccava il main ~0,7 s ogni 2 s (#474). */
  scrivi() {
    fs.mkdirSync(this.cartella, { recursive: true });
    for (const id of this.sporche) {
      const f = path.join(this.cartella, `${encodeURIComponent(id)}.json`), v = this.dati[id];
      if (!v) { fs.rmSync(f, { force: true }); continue; }
      fs.writeFileSync(`${f}.tmp`, JSON.stringify(v));
      fs.renameSync(`${f}.tmp`, f);
    }
    this.sporche.clear();
    fs.rmSync(this.file, { force: true }); // il vecchio file unico, se c'era: ora è tutto nella cartella
  }

  ricostruisci(sessioni: DaIndicizzare[]): Promise<void> {
    Object.keys(this.dati).forEach((id) => this.sporche.add(id)); // i file delle voci vecchie si tolgono alla prossima scrittura
    this.dati = {};
    this.memo.clear();
    this.coda.clear();
    return this.metti(sessioni, true);
  }

  /** Toglie indice.json e le cartelle di cache, solo dentro la cartella dell'app. */
  svuota() {
    this.coda.clear();
    if (this.scrittura) clearTimeout(this.scrittura);
    this.scrittura = null;
    this.dati = {};
    this.sporche.clear();
    this.memo.clear();
    for (const p of [this.file, this.cartella, ...this.cache]) fs.rmSync(p, { recursive: true, force: true });
  }

  cerca(testo: string) { return cerca(this.dati, testo); }

  /** Byte su disco: l'indice, le due cartelle di cache (0 se mancano) e `altro`, il resto della cartella dell'app. */
  spazio() {
    const indice = dimensione(this.file) + dimensione(this.cartella), messaggi = dimensione(this.cache[0]), immagini = dimensione(this.cache[1]);
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
