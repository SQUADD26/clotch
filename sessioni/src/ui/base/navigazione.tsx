// Stato condiviso della cornice: vista aperta, sessione scelta, sezione, cronologia (indietro/avanti), barra e pannello aperti.
// Si parte da ?vista=&sessione=&sezione= (nuova finestra, scene di prova di scena.ts).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./dati";

export type Vista = "sessione" | "clotch-ai" | "casella" | "decisioni" | "regole" | "impostazioni";
/** Le viste di clotch AI: montano clotch-ai/, senza pannello. */
export const VISTE_CLOTCH_AI: readonly Vista[] = ["clotch-ai", "casella", "decisioni", "regole"];
/** `sezione`: sottopagina libera della vista (es. «generale» nelle impostazioni). */
interface Passo { vista: Vista; sessione: string | null; sezione: string | null; /** La sessione è stata aperta da una vista di clotch AI (101-45507): la barra del titolo ha «Torna a clotch AI». */ daClotchAi?: boolean }

export interface Navigazione extends Passo {
  /** `sessione` assente = resta quella di prima; `sezione` assente = nessuna. */
  apri(vista: Vista, sessione?: string | null, sezione?: string | null): void;
  indietro(): void;
  avanti(): void;
  puoIndietro: boolean;
  puoAvanti: boolean;
  /** Barra e pannello hanno uno stato per ogni misura di finestra (frame 101:29552): `barraAperta` e `pannelloAperto` sono quelli della misura di adesso. */
  barraAperta: boolean;
  alternaBarra(): void;
  pannelloAperto: boolean;
  /** Pannello destro esteso a «Info sessione» (101-33775): il bottone «Pannello» è premuto. */
  pannelloInfo: boolean;
  /** Il bottone «Pannello» gira: obiettivo -> Info sessione -> chiuso -> obiettivo. */
  alternaPannello(): void;
  /** Finestra stretta: la barra non sta accanto alla colonna ma sopra, con il velo. */
  sovrapposta: boolean;
  /** Lo dice la cornice, dopo aver misurato: `stretta` = la barra va sopra; `largo` = il pannello sta accanto alla colonna (se no, sopra). */
  adatta(stretta: boolean, largo: boolean): void;
}

/** Vero se `sezione` dell'indirizzo ha la chiave (formato delle scene di prova: «chiave:valore|chiave»). */
const chiaveDi = (chiave: string) => new RegExp(`(^|\\|)${chiave}(\\||:|$)`).test(new URLSearchParams(location.search).get("sezione") ?? "");

const Contesto = createContext<Navigazione | null>(null);

export function ConNavigazione({ children }: { children: ReactNode }) {
  const [storia, setStoria] = useState(() => {
    const q = new URLSearchParams(location.search);
    // le scene di prova aprono una sessione «da clotch AI» con `sezione` = «da-clotch-ai»
    return { passi: [{ vista: (q.get("vista") ?? "sessione") as Vista, sessione: q.get("sessione"), sezione: q.get("sezione"), daClotchAi: chiaveDi("da-clotch-ai") }], i: 0 };
  });
  const [misura, setMisura] = useState({ stretta: false, largo: true });
  // scene di prova 101:29280 (barra chiusa) e 101:29552 (barra sopra aperta)
  const prova = (chiave: string) => (new URLSearchParams(location.search).get("sezione") ?? "").split("|").includes(chiave);
  const [barraLarga, setBarraLarga] = useState(() => !prova("barra-chiusa"));
  const [barraStretta, setBarraStretta] = useState(() => prova("barra-sopra"));
  const [pannelloLargo, setPannelloLargo] = useState(true);
  const [pannelloStretto, setPannelloStretto] = useState(false);
  // le scene di prova aprono Info sessione con `sezione` = «info|…»
  const [pannelloInfo, setInfo] = useState(() => chiaveDi("info"));
  // «Pannello obiettivo» (Aspetto): com'è all'avvio; valore mancante nel file = aperto
  useEffect(() => { api().impostazioni().then((v) => setPannelloLargo(v.pannelloAperto !== false), () => {}); }, []);
  const adatta = useCallback((stretta: boolean, largo: boolean) => setMisura((m) => (m.stretta === stretta && m.largo === largo ? m : { stretta, largo })), []);
  const vai = useCallback((vista: Vista, sessione?: string | null, sezione?: string | null) => setStoria(({ passi, i }) => {
    const passo = { vista, sessione: sessione === undefined ? passi[i].sessione : sessione, sezione: sezione ?? null,
      daClotchAi: vista === "sessione" && VISTE_CLOTCH_AI.includes(passi[i].vista) };
    if (passo.vista === passi[i].vista && passo.sessione === passi[i].sessione && passo.sezione === passi[i].sezione) return { passi, i };
    // Cambiare sezione non aggiunge ostacoli al ritorno alla vista di origine; la pagina vuota dell'avvio non resta nella cronologia.
    if ((vista === "impostazioni" && passi[i].vista === "impostazioni") || (passi[i].vista === "sessione" && !passi[i].sessione))
      return { passi: [...passi.slice(0, i), passo], i };
    return { passi: [...passi.slice(0, i + 1), passo], i: i + 1 };
  }), []);
  const apri = useCallback((...a: Parameters<typeof vai>) => { setBarraStretta(false); vai(...a); }, [vai]); // scelta una sessione la barra sopra si richiude
  const pannelloAperto = misura.largo ? pannelloLargo : pannelloStretto;
  const nav = useMemo<Navigazione>(() => ({
    ...storia.passi[storia.i],
    apri,
    indietro: () => setStoria((s) => ({ ...s, i: Math.max(0, s.i - 1) })),
    avanti: () => setStoria((s) => ({ ...s, i: Math.min(s.passi.length - 1, s.i + 1) })),
    puoIndietro: storia.i > 0,
    puoAvanti: storia.i < storia.passi.length - 1,
    barraAperta: misura.stretta ? barraStretta : barraLarga,
    alternaBarra: () => (misura.stretta ? setBarraStretta : setBarraLarga)((x) => !x),
    pannelloAperto, pannelloInfo,
    alternaPannello: () => {
      const imposta = misura.largo ? setPannelloLargo : setPannelloStretto;
      if (!pannelloAperto) imposta(true);
      else if (!pannelloInfo) setInfo(true);
      else { setInfo(false); imposta(false); }
    },
    sovrapposta: misura.stretta, adatta,
  }), [storia, apri, misura, adatta, barraLarga, barraStretta, pannelloAperto, pannelloInfo]);
  return <Contesto.Provider value={nav}>{children}</Contesto.Provider>;
}

export function useNavigazione(): Navigazione {
  const n = useContext(Contesto);
  if (!n) throw new Error("useNavigazione fuori da <ConNavigazione>");
  return n;
}
