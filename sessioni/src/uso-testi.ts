// Quote d'uso (#374): le parti pure. Fonte = il feed che legge anche Clotch (AccountQuota.swift, stesse regole di Macchine);
// i testi sono quelli dei frame 101:48825 e 101:48888. Niente rete e niente Electron: lo usano main e interfaccia.
import type { QuotaUso } from "./tipi";

interface Finestra { usato: number | null; reset: number | null }
interface Account { email: string; host: string | null; ts: number | null; cinque: Finestra; sette: Finestra }

const num = (v: unknown) => (typeof v === "number" ? v : null);
const secondi = (v: unknown) => { const n = num(v); return n !== null && n > 0 ? n : null; };

/** Nome di un Mac come lo scrive il feed o `os.hostname()`: minuscolo, senza «.local». */
export const nomeMac = (h: unknown) => (typeof h === "string" && h ? h.toLowerCase().replace(/\.local$/, "") : null);

function riga(d: Record<string, unknown>): Account | null {
  if (typeof d.email !== "string" || !d.email) return null;
  return {
    email: d.email, host: nomeMac(d.host), ts: secondi(d.ts),
    cinque: { usato: num(d.five_used), reset: secondi(d.five_resets) },
    sette: { usato: num(d.seven_used), reset: secondi(d.seven_resets) },
  };
}

/** Percentuale ora; null se non c'è dato o la finestra è già ripartita (come `usedNow`). */
const usatoOra = (f: Finestra, ora: number) => (f.usato === null || (f.reset !== null && f.reset <= ora) ? null : Math.max(0, Math.min(100, f.usato)));

/** Una lettura diretta («real») vince, finché non ha 10 minuti e una riga dell'host è più nuova (come `merge`).
 *  Più righe per la stessa email (una per macchina): vince quella di questo Mac se non è vecchia, se no la più recente (#993). */
function unisci(reali: Account[], righe: Account[], ora: number, mio: string | null): Account[] {
  const tutti = new Map<string, { a: Account; reale: boolean }>();
  for (const q of reali) tutti.set(q.email, { a: q, reale: true });
  for (const r of righe) {
    const vuota: Account = { email: r.email, host: null, ts: null, cinque: { usato: null, reset: null }, sette: { usato: null, reset: null } };
    const x = tutti.get(r.email) ?? { a: vuota, reale: false };
    const t = (q: Account) => q.ts ?? 0;
    if (x.reale && ora - t(x.a) >= 600 && t(r) > t(x.a)) x.reale = false;
    const rango = (q: Account) => (mio && q.host === mio && !vecchio(q, ora) ? 1e12 : 0) + t(q);
    if (!x.reale && rango(r) >= rango(x.a)) x.a = r;
    tutti.set(r.email, x);
  }
  return [...tutti.values()].map((x) => x.a);
}

const vecchio = (a: Account, ora: number) => a.ts === null || ora - a.ts >= 86_400;

const orario = (ms: number) => new Date(ms).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

/** «Riparte tra 6 giorni e 22 ore» (101:48825). shortcut: sotto il giorno i frame non dicono il testo, uso «Riparte tra 5 ore»; quando c'è il frame, qui. */
export function riparteTra(reset: number, ora: number): string {
  const s = Math.max(0, reset - ora);
  const g = Math.floor(s / 86_400), h = g ? Math.floor((s % 86_400) / 3600) : Math.max(1, Math.ceil(s / 3600));
  const parti = [g && `${g} ${g === 1 ? "giorno" : "giorni"}`, h && `${h} ${h === 1 ? "ora" : "ore"}`].filter(Boolean);
  return `Riparte tra ${parti.join(" e ")}`;
}

/** Percentuale intera ora (0 se la finestra è ripartita) e fine in ms (null se già ripartita); null senza dato: i numeri della barra account (#478). */
const pct = (f: Finestra, ora: number) => (f.usato === null ? null : Math.round(usatoOra(f, ora) ?? 0));
const fine = (f: Finestra, ora: number) => (f.reset !== null && f.reset > ora ? f.reset * 1000 : null);

/** Conto alla rovescia vivo di 101:48825-style: «2 h 14 m 08 s»; da un giorno in su «3 g 05 h 12 m 40 s» (frame 148:62191). */
export function contoAllaRovescia(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000)), due = (n: number) => String(n).padStart(2, "0");
  const g = Math.floor(t / 86_400), h = Math.floor((t % 86_400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return g ? `${g} g ${due(h)} h ${due(m)} m ${due(s)} s` : `${h} h ${due(m)} m ${due(s)} s`;
}

/** Il feed -> una riga per account. Tempi in secondi come li dà il feed, `ora` in ms. Null se il feed non si capisce. */
export function quoteDalFeed(json: unknown, oraMs: number, mio: string | null = null): QuotaUso[] | null {
  const radice = json as { rows?: unknown; real?: unknown } | null;
  if (!radice || !Array.isArray(radice.rows)) return null;
  const ora = oraMs / 1000, come = (v: unknown) => (Array.isArray(v) ? v : []).map((d) => riga(d as Record<string, unknown>)).filter((a): a is Account => !!a);
  const uso: QuotaUso[] = [];
  // un account senza lettura da un giorno non ha numeri; senza dato del 7 giorni neanche. Ordine fisso per email: l'elenco e i colori non si spostano con l'uso (#1146)
  const vivi = unisci(come(radice.real), come(radice.rows), ora, mio).filter((a) => !vecchio(a, ora) && a.sette.usato !== null).sort((a, b) => (a.email < b.email ? -1 : a.email > b.email ? 1 : 0));
  const corto = (e: string) => e.split("@")[0], doppi = new Set(vivi.map((a) => corto(a.email)).filter((c, i, l) => l.indexOf(c) !== i));
  for (const a of vivi) {
    // due account con lo stesso nome corto (info@dentalspace.ai, info@squaddcrm.com) si chiamano con l'email intera (#1146)
    const account = doppi.has(corto(a.email)) ? a.email : corto(a.email), letto = a.ts! * 1000;
    const finestre = { email: a.email, cinque: pct(a.cinque, ora), cinqueFine: fine(a.cinque, ora), sette: pct(a.sette, ora), setteFine: fine(a.sette, ora) };
    if ((usatoOra(a.cinque, ora) ?? 0) >= 100) {
      uso.push({ account, usato: 100, ripartenza: `Limite raggiunto riparte alle ${orario(a.cinque.reset! * 1000)}`, letto, ...finestre });
      continue;
    }
    const sette = usatoOra(a.sette, ora);
    uso.push({ account, usato: Math.round(sette ?? 0), ripartenza: sette === null ? "" : riparteTra(a.sette.reset ?? ora, ora), letto, ...finestre });
  }
  return uso;
}

/** «1 min fa» (nota di 101:48825). Meno di un minuto conta 1; più di un'ora in ore. Senza dato: adesso. */
export function fa(da: number | undefined, ora: number): string {
  const min = Math.max(1, Math.floor((ora - (da ?? ora)) / 60_000));
  return min < 60 ? `${min} min fa` : `${Math.floor(min / 60)} h fa`;
}
