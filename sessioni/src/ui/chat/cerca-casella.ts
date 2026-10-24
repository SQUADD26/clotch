// Cosa sta scrivendo Roberto nella casella (#437): un comando con «/» a inizio testo (101:26745) o un file con «@» (101:27018).
import type { VoceComando } from "../../tipi";

export type Cerca = { tipo: "comando" | "file"; query: string; da: number; a: number };

/** Il pezzo di testo che il menu sostituisce: `/co` solo se è la prima parola, `@lett` dopo uno spazio o a capo. `caret` = dove sta il cursore; il pezzo arriva fino a fine parola. */
export function cercaDi(testo: string, caret: number): Cerca | null {
  const prima = testo.slice(0, caret), a = caret + (/^\S*/.exec(testo.slice(caret))?.[0].length ?? 0);
  if (/^\/[^\s/]*$/.test(prima)) return { tipo: "comando", query: prima.slice(1), da: 0, a };
  const m = /(?:^|\s)@([^\s@]*)$/.exec(prima);
  return m ? { tipo: "file", query: m[1], da: caret - m[1].length - 1, a } : null;
}

/** I comandi che contengono la ricerca, prima quelli che iniziano con essa; l'ordine di partenza resta. */
export const filtraComandi = (voci: VoceComando[], query: string) => {
  const q = query.toLowerCase(), nome = (v: VoceComando) => v.nome.slice(1).toLowerCase(); // il «/» non conta
  return [...voci.filter((v) => nome(v).startsWith(q)), ...voci.filter((v) => !nome(v).startsWith(q) && nome(v).includes(q))];
};

/** Il testo dopo la scelta: la voce prende il posto del pezzo cercato, con uno spazio per continuare a scrivere. */
export function conScelta(testo: string, c: Cerca, voce: string) {
  const dopo = testo.slice(c.a).replace(/^ /, "");
  return { testo: `${testo.slice(0, c.da)}${voce} ${dopo}`, caret: c.da + voce.length + 1 };
}
