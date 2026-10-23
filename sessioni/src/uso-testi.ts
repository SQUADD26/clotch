// Quote d'uso (#374): le parti pure. Fonte = il feed che legge anche Clotch (AccountQuota.swift, stesse regole di Macchine);
// i testi sono quelli dei frame 101:48825 e 101:48888. Niente rete e niente Electron: lo usano main e interfaccia.
import type { QuotaUso } from "./tipi";

interface Finestra { usato: number | null; reset: number | null }
interface Account { email: string; ts: number | null; cinque: Finestra; sette: Finestra }

const num = (v: unknown) => (typeof v === "number" ? v : null);
const secondi = (v: unknown) => { const n = num(v); return n !== null && n > 0 ? n : null; };

function riga(d: Record<string, unknown>): Account | null {
  if (typeof d.email !== "string" || !d.email) return null;
  return {
    email: d.email, ts: secondi(d.ts),
    cinque: { usato: num(d.five_used), reset: secondi(d.five_resets) },
    sette: { usato: num(d.seven_used), reset: secondi(d.seven_resets) },
  };
}

/** Percentuale ora; null se non c'è dato o la finestra è già ripartita (come `usedNow`). */
const usatoOra = (f: Finestra, ora: number) => (f.usato === null || (f.reset !== null && f.reset <= ora) ? null : Math.max(0, Math.min(100, f.usato)));
/** Quanto resta; una finestra ripartita dopo la lettura è di nuovo intera (come `leftNow`). */
const restaOra = (f: Finestra, ora: number) => { const u = usatoOra(f, ora); return u !== null ? 100 - u : f.usato !== null && f.reset !== null ? 100 : null; };

/** Una lettura diretta («real») vince, finché non ha 10 minuti e una riga dell'host è più nuova (come `merge`). */
function unisci(reali: Account[], righe: Account[], ora: number): Account[] {
  const tutti = new Map<string, { a: Account; reale: boolean }>();
  for (const q of reali) tutti.set(q.email, { a: q, reale: true });
  for (const r of righe) {
    const vuota: Account = { email: r.email, ts: null, cinque: { usato: null, reset: null }, sette: { usato: null, reset: null } };
    const x = tutti.get(r.email) ?? { a: vuota, reale: false };
    const t = (q: Account) => q.ts ?? 0;
    if (x.reale && ora - t(x.a) >= 600 && t(r) > t(x.a)) x.reale = false;
    if (!x.reale && t(r) >= t(x.a)) x.a = r;
    tutti.set(r.email, x);
  }
  return [...tutti.values()].map((x) => x.a);
}

const vecchio = (a: Account, ora: number) => a.ts === null || ora - a.ts >= 86_400;

/** Prima i dati freschi, poi l'account da usare per primo: molto margine davanti, quelli quasi finiti dopo, per ripartenza. */
function ordina(l: Account[], ora: number): Account[] {
  const chiave = (a: Account): number[] => {
    const c = restaOra(a.cinque, ora), s = restaOra(a.sette, ora);
    const fascia = (s ?? 100) < 5 ? 2 : (c ?? 100) < 5 ? 1 : 0;
    const reset = (fascia === 2 ? a.sette.reset : a.cinque.reset) ?? Infinity;
    return [vecchio(a, ora) ? 1 : 0, fascia, fascia === 0 ? -Math.min(c ?? 50, s ?? 50) : reset, -(ora - (a.ts ?? -Infinity))];
  };
  return [...l].sort((a, b) => {
    const ka = chiave(a), kb = chiave(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    return a.email < b.email ? -1 : a.email > b.email ? 1 : 0;
  });
}

const orario = (ms: number) => new Date(ms).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

/** «Riparte tra 6 giorni e 22 ore» (101:48825). shortcut: sotto il giorno i frame non dicono il testo, uso «Riparte tra 5 ore»; quando c'è il frame, qui. */
export function riparteTra(reset: number, ora: number): string {
  const s = Math.max(0, reset - ora);
  const g = Math.floor(s / 86_400), h = g ? Math.floor((s % 86_400) / 3600) : Math.max(1, Math.ceil(s / 3600));
  const parti = [g && `${g} ${g === 1 ? "giorno" : "giorni"}`, h && `${h} ${h === 1 ? "ora" : "ore"}`].filter(Boolean);
  return `Riparte tra ${parti.join(" e ")}`;
}

/** Il feed -> una riga per account. Tempi in secondi come li dà il feed, `ora` in ms. Null se il feed non si capisce. */
export function quoteDalFeed(json: unknown, oraMs: number): QuotaUso[] | null {
  const radice = json as { rows?: unknown; real?: unknown } | null;
  if (!radice || !Array.isArray(radice.rows)) return null;
  const ora = oraMs / 1000, come = (v: unknown) => (Array.isArray(v) ? v : []).map((d) => riga(d as Record<string, unknown>)).filter((a): a is Account => !!a);
  const uso: QuotaUso[] = [];
  // un account senza lettura da un giorno non ha numeri; senza dato del 7 giorni neanche
  for (const a of ordina(unisci(come(radice.real), come(radice.rows), ora), ora)) {
    if (vecchio(a, ora) || a.sette.usato === null) continue;
    const account = a.email.split("@")[0], letto = a.ts! * 1000;
    if ((usatoOra(a.cinque, ora) ?? 0) >= 100) {
      uso.push({ account, usato: 100, ripartenza: `Limite raggiunto · riparte alle ${orario(a.cinque.reset! * 1000)}`, letto });
      continue;
    }
    const sette = usatoOra(a.sette, ora);
    uso.push({ account, usato: Math.round(sette ?? 0), ripartenza: sette === null ? "" : riparteTra(a.sette.reset ?? ora, ora), letto });
  }
  return uso;
}

/** «1 min fa» (nota di 101:48825). Meno di un minuto conta 1; più di un'ora in ore. Senza dato: adesso. */
export function fa(da: number | undefined, ora: number): string {
  const min = Math.max(1, Math.floor((ora - (da ?? ora)) / 60_000));
  return min < 60 ? `${min} min fa` : `${Math.floor(min / 60)} h fa`;
}
