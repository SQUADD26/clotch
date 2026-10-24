// Liste lunghe della barra montate a pezzi (#474): una cartella con centinaia di sessioni, o l'elenco di centinaia di cartelle,
// entra un pezzo per fotogramma invece che tutta in uno: aprirla non blocca la finestra (prima: fotogrammi fino a 326 ms).
import { useEffect, useState, type ReactNode } from "react";

const PEZZO = 40; // righe per fotogramma: ~40 righe stanno ben sotto i 16 ms

/** `figli(quante)`: gli elementi da mostrare ora. `subito` (scene di parità): tutto al primo disegno. */
export function APezzi({ n, subito, figli }: { n: number; subito?: boolean; figli: (quante: number) => ReactNode }) {
  const [quante, setQuante] = useState(() => (subito ? n : Math.min(n, PEZZO)));
  useEffect(() => {
    if (quante >= n) return;
    const r = requestAnimationFrame(() => setQuante((q) => Math.min(n, q + PEZZO)));
    return () => cancelAnimationFrame(r);
  }, [quante, n]);
  return <>{figli(subito ? n : Math.min(quante, n))}</>;
}
