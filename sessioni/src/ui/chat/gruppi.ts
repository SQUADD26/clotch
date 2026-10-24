// Il filo compatto (#876): le chiamate di fila di un turno diventano un gruppo «Ha usato 6 strumenti · 41 s», chiuso da solo.
// Puro: niente DOM. Il gruppo tiene i blocchi com'erano, con chiave e stato; il filo decide come mostrarli.
import type { Blocco } from "./modello";

export type BloccoStrumento = Extract<Blocco, { tipo: "strumento" | "web" | "modifica" }>;

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
  /** Quante immagini hanno dato le chiamate («Schermata»): si vedono piccole dentro il gruppo. */
  immagini: number;
}

const diStrumento = (b: Blocco): b is BloccoStrumento => b.tipo === "strumento" || b.tipo === "web" || b.tipo === "modifica";

/** I blocchi del turno, con ogni fila di chiamate al posto suo dentro un gruppo. Il resto resta com'è e nell'ordine. */
export function raggruppa(blocchi: readonly Blocco[]): (Blocco | Gruppo)[] {
  const out: (Blocco | Gruppo)[] = [];
  let g: Gruppo | null = null;
  for (const b of blocchi) {
    if (!diStrumento(b)) { g = null; out.push(b); continue; }
    if (!g) out.push(g = { tipo: "gruppo", chiave: b.chiave, strumenti: [], durata: 0, errori: [], inCorso: null, immagini: 0 });
    g.strumenti.push(b);
    if ("durata" in b && b.durata != null) g.durata += b.durata;
    if (b.tipo === "strumento") {
      if (b.stato === "errore") g.errori.push(b);
      if (b.stato === "in-corso") g.inCorso = b;
      g.immagini += b.immagini?.length ?? 0;
    }
  }
  return out;
}

/** La frase di una riga del gruppo: quella dello strumento, o quella che il blocco porta già. */
export function fraseDi(b: BloccoStrumento) {
  if (b.tipo === "strumento") return b.frase;
  if (b.tipo === "web") return `Cerca sul web «${b.query}»`;
  return `Modifica ${b.file.split("/").pop()}`;
}
