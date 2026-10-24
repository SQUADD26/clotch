// La pila degli avvisi ha un tetto (#1068): chi esce è prima il più vecchio che sparirebbe da solo, poi il più vecchio errore; un caricamento resta finché qualcuno non lo aggiorna.
export const MAX_AVVISI = 5;

export interface AvvisoPila { tipo: "info" | "successo" | "errore" | "caricamento"; messaggio: string }

/** Stesso tipo e stesso messaggio: è lo stesso avviso (un errore che si ripete non fa una pila). */
export const uguale = (a: AvvisoPila, b: AvvisoPila) => a.tipo === b.tipo && a.messaggio === b.messaggio;

export function taglia<T extends AvvisoPila>(lista: T[]): T[] {
  const l = [...lista];
  while (l.length > MAX_AVVISI) {
    const i = [(x: T) => x.tipo === "info" || x.tipo === "successo", (x: T) => x.tipo === "errore", () => true].map((f) => l.findIndex(f)).find((k) => k >= 0)!;
    l.splice(i, 1);
  }
  return l;
}
