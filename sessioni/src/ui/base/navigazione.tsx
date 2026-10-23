// Stato condiviso della cornice: vista aperta, sessione scelta, sezione, cronologia (indietro/avanti), barra e pannello aperti.
// Si parte da ?vista=&sessione=&sezione= (nuova finestra, scene di prova di scena.ts).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./dati";

export type Vista = "sessione" | "clotch-ai" | "casella" | "decisioni" | "regole" | "impostazioni";
/** Le viste di clotch AI: montano clotch-ai/, senza pannello. */
export const VISTE_CLOTCH_AI: readonly Vista[] = ["clotch-ai", "casella", "decisioni", "regole"];
/** `sezione`: sottopagina libera della vista (es. «generale» nelle impostazioni). */
interface Passo { vista: Vista; sessione: string | null; sezione: string | null }

export interface Navigazione extends Passo {
  /** `sessione` assente = resta quella di prima; `sezione` assente = nessuna. */
  apri(vista: Vista, sessione?: string | null, sezione?: string | null): void;
  indietro(): void;
  avanti(): void;
  puoIndietro: boolean;
  puoAvanti: boolean;
  barraAperta: boolean;
  alternaBarra(): void;
  pannelloAperto: boolean;
  alternaPannello(): void;
}

const Contesto = createContext<Navigazione | null>(null);

export function ConNavigazione({ children }: { children: ReactNode }) {
  const [storia, setStoria] = useState(() => {
    const q = new URLSearchParams(location.search);
    return { passi: [{ vista: (q.get("vista") ?? "sessione") as Vista, sessione: q.get("sessione"), sezione: q.get("sezione") }], i: 0 };
  });
  const [barraAperta, setBarra] = useState(true);
  const [pannelloAperto, setPannello] = useState(true);
  // «Pannello obiettivo» (Aspetto): com'è all'avvio; valore mancante nel file = aperto
  useEffect(() => { api().impostazioni().then((v) => setPannello(v.pannelloAperto !== false), () => {}); }, []);
  const apri = useCallback((vista: Vista, sessione?: string | null, sezione?: string | null) => setStoria(({ passi, i }) => {
    const passo = { vista, sessione: sessione === undefined ? passi[i].sessione : sessione, sezione: sezione ?? null };
    if (passo.vista === passi[i].vista && passo.sessione === passi[i].sessione && passo.sezione === passi[i].sezione) return { passi, i };
    // Cambiare sezione non aggiunge ostacoli al ritorno alla vista di origine.
    if (vista === "impostazioni" && passi[i].vista === "impostazioni")
      return { passi: [...passi.slice(0, i), passo], i };
    return { passi: [...passi.slice(0, i + 1), passo], i: i + 1 };
  }), []);
  const nav = useMemo<Navigazione>(() => ({
    ...storia.passi[storia.i],
    apri,
    indietro: () => setStoria((s) => ({ ...s, i: Math.max(0, s.i - 1) })),
    avanti: () => setStoria((s) => ({ ...s, i: Math.min(s.passi.length - 1, s.i + 1) })),
    puoIndietro: storia.i > 0,
    puoAvanti: storia.i < storia.passi.length - 1,
    barraAperta, alternaBarra: () => setBarra((x) => !x),
    pannelloAperto, alternaPannello: () => setPannello((x) => !x),
  }), [storia, apri, barraAperta, pannelloAperto]);
  return <Contesto.Provider value={nav}>{children}</Contesto.Provider>;
}

export function useNavigazione(): Navigazione {
  const n = useContext(Contesto);
  if (!n) throw new Error("useNavigazione fuori da <ConNavigazione>");
  return n;
}
