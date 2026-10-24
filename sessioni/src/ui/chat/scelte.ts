// Le scelte della casella (#437): permessi 101:26398, modello e sforzo 101:26707 e 148:28674, contesto usato 101:26425, messaggio non inviato 101:27798.
// Le scelte per chat stanno nelle preferenze della sessione (`modello` è l'id CLI che #457 manda al motore).
import type { EsitoComando } from "../../comandi";
import type { ModelloMotore, PreferenzeSessione, Sessione } from "../../tipi";
import { èModello, MODELLI } from "./testi";

/** «claude-opus-5-5» -> «Opus 5.5», come «chip modello» e l'intestazione. */
export const nomeModello = (m: string | null) => {
  const x = m?.match(/^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/);
  return x ? `${x[1][0].toUpperCase()}${x[1].slice(1)} ${x[2]}${x[3] ? `.${x[3]}` : ""}` : m;
};

export interface Scelta { id: string; etichetta: string; descrizione?: string; pericolo?: boolean }

export const PERMESSI: Scelta[] = [
  { id: "default", etichetta: "Chiedi approvazione", descrizione: "Chiede prima di modificare file o lanciare comandi" },
  { id: "acceptEdits", etichetta: "Accetta le modifiche", descrizione: "Modifica i file da sola, chiede per i comandi" },
  { id: "plan", etichetta: "Solo piano", descrizione: "Legge e propone, non cambia niente" },
  { id: "bypassPermissions", etichetta: "Tutto senza chiedere", descrizione: "Rischio alto: nessuna domanda", pericolo: true },
];

/** Ordine del menu modello (101:26707 → 148:28674): i quattro modelli noti; un modello nuovo di `MODELLI` va in fondo. */
const ORDINE_MENU = ["claude-opus-5-5", "claude-fable-5-1", "claude-sonnet-5-5", "claude-haiku-5-5"];
const posto = (id: string) => (ORDINE_MENU.includes(id) ? ORDINE_MENU.indexOf(id) : ORDINE_MENU.length);
/** Dalla lista unica dei modelli (testi.ts): etichetta «Opus 5.5» e id CLI. */
export const MODELLI_MENU: Scelta[] = Object.entries(MODELLI).map(([etichetta, m]) => ({ id: m.id, etichetta })).sort((x, y) => posto(x.id) - posto(y.id));

export const SFORZI: Scelta[] = [
  { id: "low", etichetta: "Basso" }, { id: "medium", etichetta: "Medio" }, { id: "high", etichetta: "Alto" },
  { id: "xhigh", etichetta: "Molto alto" }, { id: "max", etichetta: "Massimo" },
];
export const SFORZO_BASE = "medium";

/** Percentuale di contesto usata sulla finestra dichiarata dal motore (`contesto_max`); null se manca uno dei due: mai una finestra inventata. */
export const percentoContesto = (token: number | null | undefined, max: number | null | undefined) =>
  token == null || !max ? null : Math.min(100, Math.round((token / max) * 100));

/** Id della modalità dei permessi in uso: la scelta fatta qui, poi quella della trascrizione, poi la prudente. */
export const permessiDi = (s: Pick<Sessione, "permessi">, p?: PreferenzeSessione) =>
  [p?.permessi, s.permessi].find((x) => PERMESSI.some((v) => v.id === x)) ?? "default";

/** Id CLI del modello in uso: la scelta fatta qui, altrimenti quello della sessione (può avere un suffisso di data). */
export const modelloDi = (s: Pick<Sessione, "modello">, p?: PreferenzeSessione) =>
  p?.modello ?? MODELLI_MENU.find((m) => èModello(s.modello, m.id))?.id ?? s.modello;

/** Etichetta dell'id CLI (`claude-opus-5-5` → «Opus 5.5»); undefined se non è un modello noto. */
export const etichettaModello = (id: string | null | undefined) => MODELLI_MENU.find((m) => èModello(id, m.id))?.etichetta;

/** Impegno in uso: la scelta fatta qui, altrimenti il predefinito del modello (`base`, di solito «medio»). */
export const sforzoDi = (p?: PreferenzeSessione, base = SFORZO_BASE) =>
  SFORZI.find((x) => x.id === p?.sforzo) ?? SFORZI.find((x) => x.id === base) ?? SFORZI.find((x) => x.id === SFORZO_BASE)!;

/** La voce del catalogo del motore per un id CLI (può avere un suffisso di data). */
export const voceCatalogo = (cat: ModelloMotore[] | null, id: string | null | undefined) => (id ? cat?.find((m) => èModello(id, m.modello)) : undefined);
/** Modelli del menu: i quattro principali e, dal catalogo, gli altri («Altri modelli»). Senza catalogo la lista fissa di sopra. */
export function modelliMenu(cat: ModelloMotore[] | null): { principali: Scelta[]; altri: Scelta[] } {
  if (!cat) return { principali: MODELLI_MENU, altri: [] };
  const tutti = cat.map((m) => ({ id: m.modello, etichetta: etichettaModello(m.modello) ?? nomeModello(m.modello) ?? m.modello })).sort((x, y) => posto(x.id) - posto(y.id));
  const noti = tutti.filter((x) => ORDINE_MENU.includes(x.id)), principali = noti.length ? noti : tutti.slice(0, 4);
  return { principali, altri: tutti.filter((x) => !principali.includes(x)) };
}
/** Gli impegni del modello: quelli del catalogo (`[]` = nessuno, niente «Impegno»); senza catalogo o senza il campo, i cinque livelli. */
export const sforziDi = (cat: ModelloMotore[] | null, id: string | null | undefined): Scelta[] => {
  const e = voceCatalogo(cat, id)?.sforzi;
  return e ? e.map((x) => SFORZI.find((s) => s.id === x) ?? { id: x, etichetta: x }) : SFORZI;
};
/** L'interruttore veloce c'è se il catalogo dice `rapida` per il modello; senza catalogo c'è sempre. */
export const haRapida = (cat: ModelloMotore[] | null, id: string | null | undefined) => !cat || voceCatalogo(cat, id)?.rapida === true;

/** Dalle preferenze cambiate ai campi di `sessione_imposta`: solo modello, impegno e modalità veloce; `null` = tornato al predefinito (impegno predefinito `base`, veloce spenta). undefined se non ne cambia nessuno. */
export function impostazioneMotore(parte: Partial<Record<keyof PreferenzeSessione, unknown>>, base = SFORZO_BASE) {
  const o: { modello?: string; sforzo?: string; rapida?: boolean } = {};
  if (typeof parte.modello === "string") o.modello = parte.modello;
  if ("sforzo" in parte) o.sforzo = (parte.sforzo as string | null) ?? base;
  if ("rapida" in parte) o.rapida = parte.rapida === true;
  return Object.keys(o).length ? o : undefined;
}

/** «Non inviato: la sessione non risponde.»: il perché dall'esito del comando (null = il canale verso il motore è caduto). */
export function motivoNonInviato(e: EsitoComando | null): string {
  const perche = !e ? "la sessione non è raggiungibile"
    : e.esito === "scaduto" ? "la sessione non risponde"
    : e.esito === "non_scritto" ? "il messaggio non si è potuto scrivere"
    : e.testo.trim() || (e.esito === "rifiutato" ? "il motore l’ha rifiutato" : "il motore ha dato un errore");
  return `Non inviato: ${perche.replace(/\.$/, "")}.`;
}
