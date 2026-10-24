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
 */
export async function usoAlGiorno(radici: Radice[], ora = Date.now()): Promise<Map<string, { giorno: string; v: number }[]>> {
  const oggi = Math.floor(ora / MS_GIORNO), da = (oggi - GIORNI + 1) * MS_GIORNO;
  const out = new Map<string, number[]>();
  for (const r of radici) {
    const chiave = r.email?.split("@")[0];
    if (!chiave) continue;
    const somme = out.get(chiave) ?? new Array<number>(GIORNI).fill(0), visti = new Set<string>();
    out.set(chiave, somme);
    let nomi: string[] = [];
    try { nomi = (await fs.readdir(path.join(r.path, "projects"), { recursive: true })).filter((n) => n.endsWith(".jsonl")); } catch { continue; }
    for (const n of nomi) {
      const file = path.join(r.path, "projects", n);
      let testo: string;
      try { if ((await fs.stat(file)).mtimeMs < da) continue; testo = await fs.readFile(file, "utf8"); } catch { continue; }
      for (const riga of testo.split("\n")) {
        if (!riga.includes('"usage"')) continue;
        try {
          const o = JSON.parse(riga), u = o.message?.usage, t = Date.parse(o.timestamp);
          const id = o.message?.id && o.requestId ? `${o.message.id}:${o.requestId}` : null;
          if (o.type !== "assistant" || !u || !(t >= da) || t >= (oggi + 1) * MS_GIORNO || (id && visti.has(id))) continue;
          if (id) visti.add(id);
          somme[Math.floor(t / MS_GIORNO) - (oggi - GIORNI + 1)] += (+u.input_tokens || 0) + (+u.output_tokens || 0) + (+u.cache_creation_input_tokens || 0);
        } catch { /* riga non JSON */ }
      }
    }
  }
  return new Map([...out].map(([k, v]) => [k, v.map((n, i) => ({ giorno: new Date((oggi - GIORNI + 1 + i) * MS_GIORNO).toISOString().slice(0, 10), v: n }))]));
}

/** Le quote del feed con `giorni` per ogni account (zeri se non ha trascrizioni); senza nessun uso nel periodo la serie manca e la scheda resta vuota. */
export async function quoteConGiorni(radici: Radice[], ora = Date.now()): Promise<QuotaUso[]> {
  if (!(giorniCache && ora - giorniCache.quando < CACHE_MS)) giorniCache = null;
  const [quote, uso] = await Promise.all([quoteUso(ora), giorniCache?.dati ?? usoAlGiorno(radici, ora)]);
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
export const svuotaCache = () => { cache = null; inVolo = null; giorniCache = null; };
