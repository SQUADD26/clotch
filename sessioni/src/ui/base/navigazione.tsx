// Stato condiviso della cornice: vista aperta, sessione scelta, sezione, cronologia (indietro/avanti), barra e pannello aperti.
// Si parte da ?vista=&sessione=&sezione= (nuova finestra, scene di prova di scena.ts).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./dati";

export type Vista = "sessione" | "friday" | "casella" | "decisioni" | "regole" | "impostazioni";
/** Le viste di Friday: montano friday/, senza pannello. */
export const VISTE_FRIDAY: readonly Vista[] = ["friday", "casella", "decisioni", "regole"];
/** `sezione`: sottopagina libera della vista (es. «generale» nelle impostazioni). */
interface Passo { vista: Vista; sessione: string | null; sezione: string | null; /** La sessione è stata aperta da una vista di clotch AI (101-45507): la barra del titolo ha «Torna a clotch AI». */ daFriday?: boolean }

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
  /** Pannello destro esteso a «Info sessione» (101-33775): il bottone «Pannello» è premuto. */
  pannelloInfo: boolean;
  /** Il bottone «Pannello» gira: obiettivo -> Info sessione -> chiuso -> obiettivo. */
  alternaPannello(): void;
}

/** Vero se `sezione` dell'indirizzo ha la chiave (formato delle scene di prova: «chiave:valore|chiave»). */
const chiaveDi = (chiave: string) => new RegExp(`(^|\\|)${chiave}(\\||:|$)`).test(new URLSearchParams(location.search).get("sezione") ?? "");

const Contesto = createContext<Navigazione | null>(null);

export function ConNavigazione({ children }: { children: ReactNode }) {
  const [storia, setStoria] = useState(() => {
    const q = new URLSearchParams(location.search);
    // le scene di prova aprono una sessione «da clotch AI» con `sezione` = «da-friday»
    return { passi: [{ vista: (q.get("vista") ?? "sessione") as Vista, sessione: q.get("sessione"), sezione: q.get("sezione"), daFriday: chiaveDi("da-friday") }], i: 0 };
  });
  const [barraAperta, setBarra] = useState(true);
  const [pannelloAperto, setPannello] = useState(true);
  // le scene di prova aprono Info sessione con `sezione` = «info|…»
  const [pannelloInfo, setInfo] = useState(() => chiaveDi("info"));
  // «Pannello obiettivo» (Aspetto): com'è all'avvio; valore mancante nel file = aperto
  useEffect(() => { api().impostazioni().then((v) => setPannello(v.pannelloAperto !== false), () => {}); }, []);
  const apri = useCallback((vista: Vista, sessione?: string | null, sezione?: string | null) => setStoria(({ passi, i }) => {
    const passo = { vista, sessione: sessione === undefined ? passi[i].sessione : sessione, sezione: sezione ?? null,
      daFriday: vista === "sessione" && VISTE_FRIDAY.includes(passi[i].vista) };
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
    pannelloAperto, pannelloInfo,
    alternaPannello: () => {
      if (!pannelloAperto) setPannello(true);
      else if (!pannelloInfo) setInfo(true);
      else { setInfo(false); setPannello(false); }
    },
  }), [storia, apri, barraAperta, pannelloAperto, pannelloInfo]);
  return <Contesto.Provider value={nav}>{children}</Contesto.Provider>;
}

export function useNavigazione(): Navigazione {
  const n = useContext(Contesto);
  if (!n) throw new Error("useNavigazione fuori da <ConNavigazione>");
  return n;
}
