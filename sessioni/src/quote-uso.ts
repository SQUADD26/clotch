// Quote d'uso (#374): il main chiede il feed di Clotch (AccountQuotaFeed.swift: pubblico, senza token) e ne fa le righe della
// sezione Uso. Cache di 60 s; un errore di rete lancia, e la sezione non mostra numeri.
// shortcut: solo il feed (tutti gli account); l'API OAuth di un solo account (ClaudeQuotaClient) non serve e il token non si tocca.
import type { QuotaUso } from "./tipi";
import { quoteDalFeed } from "./uso-testi";

const FEED = "https://claude.squaddbackend.com/dashboard/data";
const CACHE_MS = 60_000;

let cache: { quando: number; dati: QuotaUso[] } | null = null;
let inVolo: Promise<QuotaUso[]> | null = null;

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

/** Solo per i test. */
export const svuotaCache = () => { cache = null; inVolo = null; };
