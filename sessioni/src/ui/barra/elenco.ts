// figma: 101-7728 — dall'elenco delle sessioni ai gruppi della barra: filtri, raggruppa, ordina, fissate. Puro: niente DOM.
// Testi dei frame 101:7728, 101:9860 (filtri), 101:16778 (stati), 101:17031 (proprietà), 101:30304 (raggruppa e ordina).
import type { PreferenzeSessione, Sessione, Sorgente, Stato } from "../../tipi";
import type { NomeIcona } from "../base/icone";

type StatoSegno = Stato | "errore";

export type Proprieta = "sorgente" | "stato" | "progetto" | "account" | "modello" | "ramo" | "attivita";
export type Raggruppa = "cartella" | "data" | "sorgente";
export type Ordina = "attivita" | "nome";
export interface Filtro { proprieta: Proprieta; valori: string[] }
export interface Vista { filtri: Filtro[]; raggruppa: Raggruppa; ordina: Ordina }
export type Preferenze = Record<string, PreferenzeSessione>;

/** Voci del menu «Aggiungi filtro» (101:17031), nell'ordine del disegno. */
export const PROPRIETA: { chiave: Proprieta; etichetta: string; icona: NomeIcona }[] = [
  { chiave: "sorgente", etichetta: "Sorgente", icona: "terminale" },
  { chiave: "stato", etichetta: "Stato", icona: "in-corso" },
  { chiave: "progetto", etichetta: "Progetto", icona: "cartella" },
  { chiave: "account", etichetta: "Account", icona: "persona" },
  { chiave: "modello", etichetta: "Modello", icona: "scintille" },
  { chiave: "ramo", etichetta: "Ramo", icona: "ramo" },
  { chiave: "attivita", etichetta: "Ultima attività", icona: "orologio" },
];

/** Stati del menu filtro (101:16778): etichetta della voce e forma corta della pillola (101:9860). */
export const STATI: { chiave: StatoSegno; voce: string; corta: string; icona: NomeIcona; colore: "accento" | "secondaria" | "successo" | "errore" }[] = [
  { chiave: "lavora", voce: "In corso", corta: "In corso", icona: "in-corso", colore: "accento" },
  { chiave: "aspetta", voce: "In attesa di te", corta: "In attesa", icona: "mano", colore: "accento" },
  { chiave: "ferma", voce: "In pausa", corta: "In pausa", icona: "pausa", colore: "secondaria" },
  { chiave: "finita", voce: "Finita", corta: "Finita", icona: "finita", colore: "successo" },
  { chiave: "errore", voce: "Errore", corta: "Errore", icona: "avviso", colore: "errore" },
];

const SORGENTI: Record<Sorgente, string> = { "claude-code": "Claude Code", "claude-desktop": "Claude Code", codex: "Codex", cursor: "Cursor" };
export const nomeSorgente = (s: Sorgente) => SORGENTI[s];

/** «Oggi», «Ieri», «12 ott»: le date della ricerca 101:10247. */
export function giorno(t: number, ora: number) {
  const d = new Date(t), oggi = new Date(ora);
  const ieri = new Date(ora); ieri.setDate(ieri.getDate() - 1);
  if (d.toDateString() === oggi.toDateString()) return "Oggi";
  if (d.toDateString() === ieri.toDateString()) return "Ieri";
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" }).replace(".", "");
}

/** Valore di una proprietà per filtri e menu delle opzioni. */
export function valore(s: Sessione, p: Proprieta, ora: number): string {
  switch (p) {
    case "sorgente": return nomeSorgente(s.sorgente);
    case "stato": return s.situazione?.adesso === "errore" ? "errore" : s.stato; // come il segno della riga (#636)
    case "attivita": return giorno(s.ultimaAttivita, ora);
    default: return s[p] ?? "";
  }
}

/** Opzioni di una proprietà: per lo stato le cinque del disegno, per le altre i valori presenti. */
export interface Opzione { chiave: string; voce: string; icona?: NomeIcona; colore?: (typeof STATI)[number]["colore"] }
export function opzioni(sessioni: Sessione[], p: Proprieta, ora: number): Opzione[] {
  if (p === "stato") return STATI;
  const visti = [...new Set(sessioni.map((s) => valore(s, p, ora)).filter(Boolean))];
  return visti.sort((a, b) => a.localeCompare(b)).map((v) => ({ chiave: v, voce: v }));
}

/** Testo della pillola: «Stato:» e «In attesa» (101:9860). */
export function pillola(f: Filtro) {
  const etichetta = PROPRIETA.find((p) => p.chiave === f.proprieta)!.etichetta;
  const valori = f.proprieta === "stato" ? f.valori.map((v) => STATI.find((s) => s.chiave === v)?.corta ?? v) : f.valori;
  return { proprieta: `${etichetta}:`, valore: valori.join(", ") };
}

export const passa = (s: Sessione, filtri: Filtro[], ora: number) =>
  filtri.every((f) => !f.valori.length || f.valori.includes(valore(s, f.proprieta, ora)));

export interface Gruppo { chiave: string; titolo: string; sessioni: Sessione[] }
export interface Barra { fissate: Sessione[]; titolo: string; gruppi: Gruppo[]; totale: number }

const confronta = (o: Ordina) => (a: Sessione, b: Sessione) =>
  o === "nome" ? a.titolo.localeCompare(b.titolo) : b.ultimaAttivita - a.ultimaAttivita;

/** Le sessioni come le mostra la barra: fissate in cima (e anche nel loro gruppo, 101:21065), poi gruppi per cartella, data o sorgente. */
export function componi(sessioni: Sessione[], v: Vista, pref: Preferenze, ora: number): Barra {
  const scelte = sessioni.filter((s) => passa(s, v.filtri, ora)).sort(confronta(v.ordina));
  const fissate = scelte.filter((s) => pref[s.id]?.fissa);
  const gruppi = new Map<string, Gruppo>();
  for (const s of scelte) {
    const titolo = v.raggruppa === "cartella" ? s.progetto : v.raggruppa === "sorgente" ? nomeSorgente(s.sorgente) : giorno(s.ultimaAttivita, ora);
    const g = gruppi.get(titolo) ?? { chiave: titolo, titolo, sessioni: [] };
    g.sessioni.push(s);
    gruppi.set(titolo, g);
  }
  const attivi = v.filtri.filter((f) => f.valori.length).length;
  return { fissate, gruppi: [...gruppi.values()], totale: scelte.length, titolo: attivi ? `${scelte.length} sessioni` : "Progetti" };
}

/** Riga sotto il nome nel piede: «6 account · 4 sorgenti» (101:7728), «Nessuna sessione» (101:8772). */
/** Account distinti nell'elenco (per sorgente): «Roberto · 6 account» nel bottone account della barra. */
export const numeroAccount = (sessioni: Sessione[]) => new Set(sessioni.map((s) => `${s.sorgente}:${s.account}`)).size;

export function dettaglioProfilo(sessioni: Sessione[]) {
  if (!sessioni.length) return "Nessuna sessione";
  const account = numeroAccount(sessioni);
  const sorgenti = new Set(sessioni.map((s) => s.sorgente)).size;
  return `${account} account · ${sorgenti} sorgenti`;
}

/** «Rinomina etichetta…»: l'etichetta della cartella `chiave`; vuota = torna il nome della cartella. */
export function conEtichetta(etichette: Record<string, string>, chiave: string, nome: string): Record<string, string> {
  const { [chiave]: _vecchia, ...altre } = etichette;
  return nome ? { ...altre, [chiave]: nome } : altre;
}

/** «Nascondi cartella»: i percorsi delle sue sessioni che non sono ancora tra le cartelle escluse. */
export const nuoveEscluse = (sessioni: Sessione[], escluse: string[]) =>
  [...new Set(sessioni.map((s) => s.cartella).filter((c) => c && !escluse.includes(c)))];
