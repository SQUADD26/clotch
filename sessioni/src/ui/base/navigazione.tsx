// Stato condiviso della cornice: vista aperta, sessione scelta, cronologia (indietro/avanti), barra e pannello aperti.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Vista = "sessione" | "friday" | "impostazioni";
interface Passo { vista: Vista; sessione: string | null }

export interface Navigazione extends Passo {
  apri(vista: Vista, sessione?: string | null): void;
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
  const [storia, setStoria] = useState(() => ({ passi: [{ vista: "sessione", sessione: new URLSearchParams(location.search).get("sessione") }] as Passo[], i: 0 }));
  const [barraAperta, setBarra] = useState(true);
  const [pannelloAperto, setPannello] = useState(true);
  const apri = useCallback((vista: Vista, sessione?: string | null) => setStoria(({ passi, i }) => {
    const passo = { vista, sessione: sessione === undefined ? passi[i].sessione : sessione };
    if (passo.vista === passi[i].vista && passo.sessione === passi[i].sessione) return { passi, i };
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
