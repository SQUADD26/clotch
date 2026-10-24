// Quote d'uso (#374): il main chiede il feed di Clotch (AccountQuotaFeed.swift: pubblico, senza token) e ne fa le righe della
// sezione Uso. Cache di 60 s; un errore di rete lancia, e la sezione non mostra numeri.
// shortcut: solo il feed (tutti gli account); l'API OAuth di un solo account (ClaudeQuotaClient) non serve e il token non si tocca.
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Radice } from "./radici";
import type { QuotaUso } from "./tipi";
import { quoteDalFeed } from "./uso-testi";

const FEED = "https://claude.squaddbackend.com/dashboard/data";
const CACHE_MS = 60_000;

let cache: { quando: number; dati: QuotaUso[] } | null = null;
let inVolo: Promise<QuotaUso[]> | null = null;
let giorniCache: { quando: number; dati: Awaited<ReturnType<typeof usoAlGiorno>> } | null = null;

export async function quoteUso(ora = Date.now(), leggi: () => Promise<unknown> = leggiFeed): Promise<QuotaUso[]> {
  if (cache && ora - cache.quando < CACHE_MS) return cache.dati;
  inVolo ??= leggi().then((json) => {
    const dati = quoteDalFeed(json, Date.now());
    if (!dati) throw new Error("risposta del feed non valida");
    cache = { quando: Date.now(), dati };
    return dati;
  }).finally(() => { inVolo = null; });
  return inVolo;
}

async function leggiFeed(): Promise<unknown> {
  const r = await fetch(FEED, { headers: { "User-Agent": "clotch" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`feed: HTTP ${r.status}`);
  return r.json();
}

const GIORNI = 14; // quanti ne disegna la scheda Andamento (frame 119:57613)
const MS_GIORNO = 86_400_000;

/**
 * Uso al giorno (UTC, ultimi 14, dal più vecchio a oggi) per account: token di `message.usage` nelle trascrizioni
 * `projects/**\/*.jsonl` toccate in quel periodo, ogni messaggio una volta. Il feed non dà l'uso al giorno.
 * Chiave = parte prima della @ dell'email dell'account (come `QuotaUso.account`). Un file illeggibile si salta.
 * shortcut: sono token (input + output + scrittura cache), non la % di quota; senza email nel `.claude.json` l'account non si abbina.
 * Un conteggio alla volta: `letti` è di tutti, e due sovrapposti (barra e impostazioni) leggerebbero gli stessi byte avanzando il punto di ripresa due volte.
 */
export function usoAlGiorno(radici: Radice[], ora = Date.now()): ReturnType<typeof conta> {
  const p = fila.then(() => conta(radici, ora));
  fila = p.catch(() => {});
  return p;
}
let fila: Promise<unknown> = Promise.resolve();

async function conta(radici: Radice[], ora: number): Promise<Map<string, { giorno: string; v: number }[]>> {
  const oggi = Math.floor(ora / MS_GIORNO), primo = oggi - GIORNI + 1, da = primo * MS_GIORNO;
  const out = new Map<string, number[]>(), perCartella = new Map<string, Voce[][]>(), visti = new Set<string>();
  for (const r of radici) {
    const chiave = r.email?.split("@")[0];
    if (!chiave) continue;
    const somme = out.get(chiave) ?? new Array<number>(GIORNI).fill(0), messaggi = new Set<string>();
    out.set(chiave, somme);
    // più account con `projects` linkata alla stessa cartella: una lettura sola (#474)
    const dir = path.join(r.path, "projects"), reale = await fs.realpath(dir).catch(() => dir);
    let liste = perCartella.get(reale);
    if (!liste) {
      liste = [];
      perCartella.set(reale, liste);
      let nomi: string[] = [];
      try { nomi = (await fs.readdir(dir, { recursive: true })).filter((n) => n.endsWith(".jsonl")); } catch { continue; }
      for (const n of nomi) {
        const file = path.join(reale, n);
        visti.add(file);
        try { const st = await fs.stat(file); if (st.mtimeMs >= da) liste.push(await vociDi(file, st)); } catch { /* file illeggibile: si salta */ }
      }
    }
    for (const voci of liste) for (const e of voci) {
      if (e.g < primo || e.g > oggi || (e.id && messaggi.has(e.id))) continue;
      if (e.id) messaggi.add(e.id);
      somme[e.g - primo] += e.v;
    }
  }
  for (const f of letti.keys()) if (!visti.has(f)) letti.delete(f);
  return new Map([...out].map(([k, v]) => [k, v.map((n, i) => ({ giorno: new Date((primo + i) * MS_GIORNO).toISOString().slice(0, 10), v: n }))]));
}

/** Un messaggio con uso: id (per contarlo una volta), giorno UTC assoluto, token. */
type Voce = { id: string | null; g: number; v: number };
/** Per file: dove si è arrivati e le voci già lette (#474): ogni minuto si leggono solo i byte nuovi, non tutte le trascrizioni dei 14 giorni. */
const letti = new Map<string, { ino: number; fine: number; voci: Voce[] }>();

async function vociDi(file: string, st: { ino: number; size: number }): Promise<Voce[]> {
  let c = letti.get(file);
  if (!c || c.ino !== st.ino || st.size < c.fine) c = { ino: st.ino, fine: 0, voci: [] }; // sostituito o accorciato: da capo
  letti.set(file, c);
  if (st.size <= c.fine) return c.voci;
  const fh = await fs.open(file, "r");
  try {
    const b = Buffer.alloc(st.size - c.fine);
    const { bytesRead } = await fh.read(b, 0, b.length, c.fine);
    const chiuse = b.lastIndexOf(10, bytesRead - 1) + 1; // l'ultima riga a metà si legge al giro dopo
    for (const riga of b.toString("utf8", 0, chiuse).split("\n")) {
      if (!riga.includes('"usage"')) continue;
      try {
        const o = JSON.parse(riga), u = o.message?.usage, t = Date.parse(o.timestamp);
        if (o.type !== "assistant" || !u || !Number.isFinite(t)) continue;
        c.voci.push({ id: o.message?.id && o.requestId ? `${o.message.id}:${o.requestId}` : null, g: Math.floor(t / MS_GIORNO),
          v: (+u.input_tokens || 0) + (+u.output_tokens || 0) + (+u.cache_creation_input_tokens || 0) });
      } catch { /* riga non JSON */ }
    }
    c.fine += chiuse;
  } finally { await fh.close(); }
  return c.voci;
}

/** Le quote del feed con `giorni` per ogni account (zeri se non ha trascrizioni); senza nessun uso nel periodo la serie manca e la scheda resta vuota. */
/** `contaGiorni`: chi conta i giorni; l'app lo fa fare al worker dei lavori (impostazioni.ts), i test qui. */
export async function quoteConGiorni(radici: Radice[], ora = Date.now(), contaGiorni: typeof usoAlGiorno = usoAlGiorno): Promise<QuotaUso[]> {
  if (!(giorniCache && ora - giorniCache.quando < CACHE_MS)) giorniCache = null;
  const [quote, uso] = await Promise.all([quoteUso(ora), giorniCache?.dati ?? contaGiorni(radici, ora)]);
  giorniCache ??= { quando: ora, dati: uso };
  const vuota = [...uso.values()][0]?.map((g) => ({ ...g, v: 0 }));
  if (![...uso.values()].some((g) => g.some((x) => x.v))) return quote;
  return quote.map((q) => ({ ...q, giorni: uso.get(q.account) ?? vuota }));
}

/** Quando l'uso supera l'80% e il 90%: `viste` = ultima soglia già raggiunta per account (si aggiorna qui). Lo stesso account avvisa una volta per soglia e finestra: se l'uso scende sotto, la soglia si azzera. La prima lettura di un account è solo il punto di partenza; da 100% in su c'è l'avviso del limite. */
export function sogliePassate(quote: { account: string; usato: number }[], viste: Map<string, number>): { account: string; soglia: number }[] {
  const nuove: { account: string; soglia: number }[] = [];
  for (const q of quote) {
    const soglia = [80, 90].filter((s) => q.usato >= s).pop() ?? 0, prima = viste.get(q.account);
    viste.set(q.account, soglia);
    if (prima !== undefined && soglia > prima && q.usato < 100) nuove.push({ account: q.account, soglia });
  }
  return nuove;
}

/** Solo per i test. */
export const svuotaCache = () => { cache = null; inVolo = null; giorniCache = null; letti.clear(); };
