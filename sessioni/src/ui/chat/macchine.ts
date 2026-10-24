// figma: 149-67470 — le macchine SSH di «Nuova sessione» (menu 149:67470, dialogo 149:67536, preparazione 149:67632): le regole che i pezzi leggono (nome, passi, testi). Senza React: si prova da Node.
// Tutto viene dal motore: `macchine` per l'elenco, `macchina_aggiungi` per prepararne una, eventi `macchina_passo` per l'avanzamento dal vivo (contratto v1, sez. 3).
import type { EsitoPasso, PassoMacchina } from "../../macchine-tipi";
import type { EsitoComando } from "../../comandi";

/** I passi della preparazione, nell'ordine in cui li fa il motore. */
export const PASSI = [["connessione", "Connessione"], ["python", "Python"], ["cartella", "Cartella"], ["claude", "Claude"], ["motore", "Motore"], ["login", "Login"], ["github", "GitHub"]] as const;
/** I passi fatti dal comando `macchina_aggiungi`, se l'esito li porta. */
export const passiDi = (e: EsitoComando | null) => (e && "passi" in e ? e.passi : undefined);
export const etichettaPasso = (passo: string | null) => PASSI.find(([p]) => p === passo)?.[1] ?? passo ?? "";

/** Il nome di una macchina: minuscole, numeri e trattini, da 1 a 32 caratteri (contratto, `macchina_aggiungi`). */
export const nomeValido = (n: string) => /^[a-z0-9-]{1,32}$/.test(n);

/** Perché un comando non è riuscito: il testo del motore se ha risposto, se no «clotch AI non risponde». */
export const motivoGuasto = (e: EsitoComando | null) => ((e?.esito === "rifiutato" || e?.esito === "errore") && e.testo) || "clotch AI non risponde.";

export type StatoPasso = "attesa" | "corso" | "ok" | "no";
export interface RigaPasso { passo: string; etichetta: string; stato: StatoPasso; dettaglio: string; testo: string | null; comando: string | null; url: string | null; codice: string | null }

const PRONTO: Record<string, string> = { connessione: "Collegata", python: "Pronto", claude: "Pronto", motore: "Installato", login: "Account collegato", github: "Accesso attivo" };

/** Dove ripartire: la macchina da completare dice il passo fallito; quelli prima sono fatti. */
export interface Fermata { passo: string | null; testo: string | null; comando: string | null }

/**
 * I sette passi, dal più vecchio al più nuovo: la fermata di prima, poi gli eventi `macchina_passo` di questo giro (`da` = ms di partenza),
 * poi i `passi` dell'esito se il motore ha già risposto. `ripreso` = il passo che il giro nuovo riprende («Ripreso da qui» finché non scrive il suo).
 */
export function righePassi(o: { nome: string; cartella: string; eventi: PassoMacchina[]; da: number; fermata?: Fermata | null; ripreso?: { passo: string; t: number } | null; esito?: EsitoPasso[] | null; /** Il motore ha detto «pronta»: ogni passo è fatto, anche se un evento si è perso. */ fatto?: boolean }): RigaPasso[] {
  const righe = new Map<string, RigaPasso>(PASSI.map(([passo, etichetta]) => [passo, { passo, etichetta, stato: "attesa", dettaglio: "", testo: null, comando: null, url: null, codice: null }]));
  const metti = (passo: string, stato: StatoPasso, x: { testo?: string | null; comando?: string | null; url?: string | null; codice?: string | null } = {}) => {
    const r = righe.get(passo);
    if (r) Object.assign(r, { stato, testo: x.testo ?? null, comando: x.comando ?? null, url: x.url ?? null, codice: x.codice ?? null });
  };
  const f = o.fermata;
  if (f?.passo && righe.has(f.passo)) {
    for (const [passo] of PASSI) { if (passo === f.passo) break; metti(passo, "ok"); }
    metti(f.passo, o.ripreso?.passo === f.passo ? "corso" : "no", f);
  }
  const mie = o.eventi.filter((x) => x.nome === o.nome && x.t >= o.da);
  for (const e of mie) metti(e.passo, e.ok === null ? "corso" : e.ok ? "ok" : "no", e);
  const rp = o.ripreso; // il passo che riparte non porta più l'esito del giro prima, finché non scrive il suo
  if (rp && !mie.some((e) => e.passo === rp.passo && e.t >= rp.t)) metti(rp.passo, "corso");
  for (const p of o.esito ?? []) metti(p.passo, p.ok ? "ok" : "no", p);
  if (o.fatto) for (const r of righe.values()) if (r.stato !== "ok") metti(r.passo, "ok");
  for (const r of righe.values()) {
    const azione = !!(r.comando || r.url || r.codice);
    r.dettaglio = r.stato === "ok" ? r.testo ?? (r.passo === "cartella" ? o.cartella : PRONTO[r.passo]) : r.stato === "corso" ? (r.codice ? "In attesa del codice" : r.passo === o.ripreso?.passo ? "Ripreso da qui" : "In corso")
      : r.stato === "no" ? (azione ? (r.comando ? "Da fare nel Terminale" : "Da fare nel browser") : "Non riuscito") : "In attesa";
  }
  return [...righe.values()];
}

/** Il testo del motore per un passo fallito: la prima frase è il titolo, il resto il corpo. */
export const titoloECorpo = (testo: string) => { const i = testo.indexOf(". "); return i < 0 ? { titolo: testo, corpo: "" } : { titolo: testo.slice(0, i), corpo: testo.slice(i + 2) }; };

/** Il passo dove il motore si è fermato, se c'è: la riga col suo comando o link, oppure solo il testo del perché. */
export const passoFermo = (righe: RigaPasso[]) => righe.find((r) => r.stato === "no") ?? null;
