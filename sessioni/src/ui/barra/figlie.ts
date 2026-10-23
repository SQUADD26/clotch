// figma: 101-34605 — madri e figlie nell'elenco: una sessione avviata da un'altra (`app.padre` = idApp della madre) sta sotto la madre.
import type { Sessione } from "../../tipi";

export interface Voce { s: Sessione; figlia: boolean; figlie: number }

/** Le sessioni di una cartella con le figlie sotto la madre, nell'ordine dato. Una figlia la cui madre non è nella lista resta al suo posto.
 *  Le figlie di una madre in `chiuse` non ci sono; `figlie` conta tutte quelle che ha. */
export function conFiglie(lista: Sessione[], chiuse: ReadonlySet<string>): Voce[] {
  const madre = new Map(lista.filter((s) => s.idApp).map((s) => [s.idApp!, s]));
  const padre = (s: Sessione) => (s.app?.padre ? madre.get(s.app.padre) : undefined);
  // un giro madre-figlia (non succede nei file veri) non deve far sparire righe: chi chiude il giro resta al suo posto
  const inGiro = (p: Sessione, s: Sessione) => { for (let x: Sessione | undefined = p, n = 0; x && n <= lista.length; x = padre(x), n++) if (x === s) return true; return false; };
  const figlie = new Map<string, Sessione[]>();
  const sotto = new Set<string>();
  for (const s of lista) {
    const p = padre(s);
    if (!p || inGiro(p, s)) continue;
    figlie.set(p.id, [...(figlie.get(p.id) ?? []), s]);
    sotto.add(s.id);
  }
  const aggiungi = (s: Sessione, figlia: boolean): Voce[] => {
    const k = figlie.get(s.id) ?? [];
    return [{ s, figlia, figlie: k.length }, ...(chiuse.has(s.id) ? [] : k.flatMap((x) => aggiungi(x, true)))];
  };
  return lista.filter((s) => !sotto.has(s.id)).flatMap((s) => aggiungi(s, false));
}
