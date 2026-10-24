// figma: 148-62026 — dati del bottone account in fondo alla barra (#478): quote per account dal feed, conto alla rovescia vivo,
// e l'account con cui partono le sessioni nuove (#1146): scelto dall'utente e salvato nelle impostazioni, mai dedotto dalla sessione aperta.
import { useEffect, useState } from "react";
import type { ImpostazioniApi, QuotaUso } from "../../tipi";
import { contoAllaRovescia } from "../../uso-testi";
import { nomeAccount } from "../chat/testi";

export { contoAllaRovescia };

declare global { interface Window { impostazioni: ImpostazioniApi } } // come in impostazioni/stato.ts: qui senza la sua catena di .tsx (lo legge anche il test node)

/** Nome corto dell'account: «accountmanager» da un'email, da una cartella `.claude-accountmanager` o da un nome. */
export const nome = (x: string) => nomeAccount(x.split("@")[0]);
/** Stesso account scritto in modi diversi: «.claude-terminal-r-bondici», «terminal-r-bondici», «r-bondici» (il motore usa l'ultimo). */
const chiave = (x: string) => { const n = nome(x).replace(/^terminal-/, ""); return n === "default" ? "claude" : n; }; // il motore chiama «default» la cartella ~/.claude
export function trova(quote: QuotaUso[], x: string | null | undefined): QuotaUso | undefined {
  if (!x) return undefined;
  // un'email si confronta intera: «info@dentalspace.ai» non è «info@squaddcrm.com» anche se il nome corto è uguale
  if (x.includes("@")) return quote.find((q) => q.email?.toLowerCase() === x.toLowerCase());
  const perCartella = quote.find((q) => q.cartelle?.some((c) => c === x || chiave(c) === chiave(x)));
  if (perCartella) return perCartella;
  const perNome = quote.filter((q) => q.account === nome(x));
  return perNome.length === 1 ? perNome[0] : undefined; // due account con quel nome: non si indovina (#1146)
}

/** Gli account con cui si può far partire una sessione: dati veri dal feed (letti nelle ultime 24 ore, già filtrati da `quoteDalFeed`)
 *  e una cartella di config su questo Mac (#1146). Nell'ordine del feed, fisso per email. */
export const disponibili = (quote: QuotaUso[]) => quote.filter((q) => q.email && q.cartelle?.length);

/** L'account delle sessioni nuove: quello scelto (anche se il feed oggi non lo legge: non si cambia da solo), se no quello di ~/.claude
 *  (lo usa `claude` senza altre cartelle), se no il primo disponibile. `q` = le sue quote, se il feed le ha. */
export function accountNuove(quote: QuotaUso[], scelta: string | null | undefined): { email: string | null; q: QuotaUso | undefined } {
  if (scelta) return { email: scelta, q: trova(quote, scelta) };
  const l = disponibili(quote), q = l.find((x) => x.cartelle!.includes(".claude")) ?? l[0];
  return { email: q?.email ?? null, q };
}
/** Due lettere per l'avatar. */
export const iniziali = (x: string) => x.slice(0, 2).toUpperCase();

export type Livello = "ok" | "giallo" | "pieno";
export const livello = (usato: number | null | undefined): Livello => ((usato ?? 0) >= 100 ? "pieno" : (usato ?? 0) >= 90 ? "giallo" : "ok");

/** Quanto manca: «2 h 14 m 08 s»; vuoto se la finestra è già ripartita o non ha dato. */
export const conto = (fine: number | null | undefined, ora: number) => (fine && fine > ora ? contoAllaRovescia(fine - ora) : "");

/** Quote del feed, riletto ogni minuto (la cache del main è di 60 s); null finché non arrivano o se il feed non risponde. */
export function useQuote(fisse?: QuotaUso[]): QuotaUso[] | null {
  const [quote, setQuote] = useState<QuotaUso[] | null>(null);
  useEffect(() => {
    if (fisse) return;
    let vivo = true;
    const leggi = () => { if (!document.hidden) window.impostazioni.uso().then((q) => vivo && setQuote(q), () => {}); };
    leggi();
    const t = setInterval(leggi, 60_000);
    return () => { vivo = false; clearInterval(t); };
  }, [!!fisse]);
  return fisse ?? quote;
}

/** Adesso, aggiornato ogni secondo solo mentre la finestra si vede. `fisso`: l'ora della scena di prova. */
export function useOra(fisso?: number): number {
  const [ora, setOra] = useState(() => fisso ?? Date.now());
  useEffect(() => {
    if (fisso !== undefined) return;
    const giro = () => { if (!document.hidden) setOra(Date.now()); };
    const t = setInterval(giro, 1000);
    document.addEventListener("visibilitychange", giro);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", giro); };
  }, [fisso]);
  return fisso ?? ora;
}
