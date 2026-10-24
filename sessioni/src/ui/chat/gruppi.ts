// Il filo compatto (#876): le chiamate di fila di un turno diventano un gruppo «Ha usato 6 strumenti · 41 s», chiuso da solo.
// Puro: niente DOM. Il gruppo tiene i blocchi com'erano, con chiave e stato; il filo decide come mostrarli.
import type { Blocco } from "./modello";
import { frase, type Frase } from "./strumenti";

export type BloccoStrumento = Extract<Blocco, { tipo: "strumento" | "web" }>;

export interface Gruppo {
  tipo: "gruppo";
  /** La chiave del primo blocco: il gruppo resta lo stesso mentre crescono le chiamate. */
  chiave?: string;
  strumenti: BloccoStrumento[];
  /** Somma delle durate note, in ms. */
  durata: number;
  /** Le chiamate non riuscite: si vedono anche col gruppo chiuso. */
  errori: BloccoStrumento[];
  /** La chiamata che gira ora, se c'è: la riga col riflesso. */
  inCorso: BloccoStrumento | null;
}

// le modifiche restano fuori: nel turno vivo si leggono aperte, a turno finito diventano «File toccati»
const diStrumento = (b: Blocco): b is BloccoStrumento => b.tipo === "strumento" || b.tipo === "web";

/** I blocchi del turno, con ogni fila di chiamate al posto suo dentro un gruppo. Il resto resta com'è e nell'ordine. */
export function raggruppa(blocchi: readonly Blocco[]): (Blocco | Gruppo)[] {
  const out: (Blocco | Gruppo)[] = [];
  let g: Gruppo | null = null;
  for (const b of blocchi) {
    if (!diStrumento(b)) { g = null; out.push(b); continue; }
    if (!g) out.push(g = { tipo: "gruppo", chiave: b.chiave, strumenti: [], durata: 0, errori: [], inCorso: null });
    g.strumenti.push(b);
    if (b.tipo === "strumento") {
      g.durata += b.durata ?? 0;
      if (b.stato === "errore") g.errori.push(b);
      if (b.stato === "in-corso") g.inCorso = b;
    }
  }
  return out;
}

/** La frase di una riga del gruppo: quella dello strumento, o quella che il blocco porta già. */
export const fraseDi = (b: BloccoStrumento): Frase =>
  b.tipo === "strumento" ? b.frase : frase(/^https?:\/\//.test(b.query) ? "WebFetch" : "WebSearch", { url: b.query, query: b.query });

/** «· uscita 1» di un comando non riuscito («Exit code 1» nell'esito); senza codice, «· non riuscito». */
export const esitoErrore = (uscita: string) => { const c = uscita.match(/exit code (\d+)/i); return c ? `· uscita ${c[1]}` : "· non riuscito"; };
