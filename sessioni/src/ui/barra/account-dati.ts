// figma: 148-62026 — dati del bottone account in fondo alla barra (#478): quote per account dal feed, conto alla rovescia vivo,
// account della sessione aperta o previsto per la nuova, e l'account scelto per la nuova sessione (letto da chi la avvia).
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Registro } from "../../clotch-ai";
import type { QuotaUso } from "../../tipi";
import { contoAllaRovescia } from "../../uso-testi";
import { comandaEsito } from "../chat/clotch-ai";
import { nomeAccount } from "../chat/testi";

export { contoAllaRovescia };

// Account scelto nel menu quando la vista è una sessione nuova: email (o null = «auto», sceglie il motore). Lo legge la vista «nuova sessione»
// con `accountScelto.leggi()` / `useAccountScelto()` e lo manda nel campo `account` di `nuova_sessione`.
let scelto: string | null = null;
const seguaci = new Set<() => void>();
export const accountScelto = {
  leggi: () => scelto,
  imposta(email: string | null) { scelto = email; seguaci.forEach((f) => f()); },
  segui(f: () => void) { seguaci.add(f); return () => { seguaci.delete(f); }; },
};
export const useAccountScelto = () => useSyncExternalStore(accountScelto.segui, accountScelto.leggi);

/** Nome corto dell'account: «accountmanager» da un'email, da una cartella `.claude-accountmanager` o da un nome. */
export const nome = (x: string) => nomeAccount(x.split("@")[0]);
/** Stesso account scritto in modi diversi: «.claude-terminal-r-bondici», «terminal-r-bondici», «r-bondici» (il motore usa l'ultimo). */
const chiave = (x: string) => { const n = nome(x).replace(/^terminal-/, ""); return n === "default" ? "claude" : n; }; // il motore chiama «default» la cartella ~/.claude
export const trova = (quote: QuotaUso[], x: string | null | undefined) =>
  (x ? quote.find((q) => q.email === x || q.account === nome(x) || q.cartelle?.some((c) => c === x || chiave(c) === chiave(x))) : undefined);
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

export interface Corrente {
  /** Email o cartella dell'account con cui lavora (o lavorerebbe) la sessione; null se non si sa. */
  chiave: string | null;
  /** Sessione avviata dal motore: l'account si cambia con `riprendi_altrove`. Null = sessione nuova (si sceglie per `nuova_sessione`). */
  motore: boolean | null;
}

/** Account di una sessione aperta (registro: `inizio`; se la chat non è nel registro, quello letto dal disco) o, per la nuova, quello scelto o `account_previsto`. */
export function useCorrente(chat: string | null, registro: Registro | null, daDisco: string | undefined, previsto?: string | null, nuova = false): Corrente {
  const nuovo = !chat;
  const scelto = useAccountScelto();
  const [auto, setAuto] = useState<string | null>(previsto ?? null);
  useEffect(() => {
    if (!nuova || !nuovo || previsto !== undefined) return; // `account_previsto` solo nella vista Nuova sessione
    let vivo = true;
    void comandaEsito("account_previsto", {}).then((e) => { if (vivo && e?.esito === "ok" && e.account?.email) setAuto(e.account.email); });
    return () => { vivo = false; };
  }, [nuova, nuovo, previsto]);
  if (nuovo) return { chiave: scelto ?? auto, motore: null };
  const c = registro?.chat.get(chat);
  // l'email letta dal disco è la più precisa; il nome scritto dal motore cambia forma («default», «b», «r-bondici», «r.bondici»)
  return { chiave: (daDisco?.includes("@") ? daDisco : null) ?? c?.account ?? daDisco ?? null, motore: c?.sorgente === "motore" };
}
