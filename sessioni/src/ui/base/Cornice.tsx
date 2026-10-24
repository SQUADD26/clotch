// figma: 101-8036 — «Sessione aperta · 1440» (e 101-8610 a 1024): barra del titolo e tre colonne con i punti di montaggio.
// Finestre strette e barra ridimensionabile: 101-29280, 101-29399, 101-29552, 101-29770, 101-29971 (base/layout.tsx).
import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import Barra from "../barra";
import { RicercaGlobale } from "../barra/RicercaGlobale";
import Chat, { Intestazione as IntestazioneChat } from "../chat";
import { Dialoghi } from "../dialoghi";
import ClotchAi, { Intestazione as IntestazioneClotchAi } from "../clotch-ai";
import Impostazioni from "../impostazioni";
import Pannello from "../pannello";
import { AreaAvvisi } from "./Avvisi";
import { Avvio, useCoperto } from "./Avvio";
import { useAspetto } from "./aspetto";
import { BarraTitolo } from "./BarraTitolo";
import { Pezzo } from "./Pezzo";
import { LARGHEZZA_BARRA_FISSA, ManigliaBarra, useEscChiude, useFuocoDentro, useLarghezza, useLarghezzaBarra } from "./layout";
import { useElenco } from "./dati";
import { ConNavigazione, useNavigazione, VISTE_CLOTCH_AI, type Vista } from "./navigazione";
import { useScorciatoie } from "./scorciatoie";
import { numero } from "./token";
import "./cornice.css";
import "./aspetto.css";

// Il pannello sta accanto alla colonna solo se c'è posto per entrambi (a 1440 sì, a 1024 no, come nei due frame).
const LARGHEZZA_PANNELLO = numero("misura-colonna") + numero("misura-pannello") + 3 * numero("spazio-4");

// HIG Windows: il titolo dice cosa mostra la finestra (menu Finestra, Dock, Mission Control), anche se la barra lo nasconde (#864)
const NOME_VISTA: Partial<Record<Vista, string>> = { "nuova-sessione": "Nuova sessione", "clotch-ai": "clotch AI", casella: "Casella", decisioni: "Decisioni", regole: "Regole", impostazioni: "Impostazioni" };

function Corpo() {
  const n = useNavigazione();
  useScorciatoie();
  const sessioni = useElenco().dati?.sessioni;
  const titolo = (n.vista === "sessione" ? sessioni?.find((s) => s.id === n.sessione)?.titolo : NOME_VISTA[n.vista]) || "clotch";
  useEffect(() => { document.title = titolo; }, [titolo]);
  const corpo = useRef<HTMLDivElement>(null), colonna = useRef<HTMLDivElement>(null), contenuto = useRef<HTMLDivElement>(null), sopra = useRef<HTMLElement>(null), sopraPannello = useRef<HTMLElement>(null);
  const impostazioni = n.vista === "impostazioni";
  const finestra = useLarghezza(corpo), larghezzaColonna = useLarghezza(colonna, !impostazioni);
  const largo = useLarghezza(contenuto, !impostazioni) >= LARGHEZZA_PANNELLO;
  const barra = useLarghezzaBarra();
  // finestra stretta (101:29552): la barra sta sopra; colonna sotto la bolla piena (101:29770): casella compatta
  const stretta = finestra > 0 && finestra < LARGHEZZA_BARRA_FISSA;
  const compatta = larghezzaColonna > 0 && larghezzaColonna < numero("misura-bolla-max");
  const { adatta } = n;
  useLayoutEffect(() => adatta(stretta, largo), [adatta, stretta, largo]);
  const barraSopra = n.sovrapposta && n.barraAperta;
  const chiudiBarra = useFuocoDentro(barraSopra, sopra, ".barra-titolo [aria-label='Barra laterale']", n.alternaBarra);
  useEscChiude(barraSopra, chiudiBarra);
  // il pannello sopra fa come la barra sopra (#903): clic fuori e Esc lo chiudono, il fuoco entra e torna al bottone, la colonna dietro è inerte
  const pannelloSopra = !largo && n.pannelloAperto && !impostazioni && !VISTE_CLOTCH_AI.includes(n.vista) && n.vista !== "nuova-sessione";
  const chiudiPannello = useFuocoDentro(pannelloSopra, sopraPannello, ".pezzo-chat [aria-label='Mostra pannello']", n.chiudiPannello);
  useEscChiude(pannelloSopra, chiudiPannello);
  // sotto il velo della barra sopra niente fuoco né clic (#941)
  const attributi = { ref: corpo, inert: useCoperto() || barraSopra || undefined, "data-compatta": compatta || undefined, style: { "--larghezza-barra": `${barra.w}px` } as CSSProperties };
  if (impostazioni) return <div className="corpo" {...attributi}><Pezzo nome="impostazioni" centro><Impostazioni /></Pezzo></div>;
  const clotchAi = VISTE_CLOTCH_AI.includes(n.vista);
  const fissa = n.barraAperta && !n.sovrapposta;
  return (
    <>
      <div className="corpo" {...attributi}>
        {fissa && <nav className="barra-laterale"><Pezzo nome="barra" centro><Barra /></Pezzo></nav>}
        {fissa && <ManigliaBarra corpo={corpo} {...barra} />}
        <main className="area-principale" tabIndex={-1}>
          <div className="superficie">
            {clotchAi ? <Pezzo nome="clotch-ai"><IntestazioneClotchAi /></Pezzo> : <Pezzo nome="chat"><IntestazioneChat /></Pezzo>}
            <div className="contenuto" ref={contenuto}>
              <div className="colonna" ref={colonna} inert={pannelloSopra || undefined}>
                {clotchAi ? <Pezzo nome="clotch-ai" centro><ClotchAi /></Pezzo> : <Pezzo nome="chat" centro><Chat /></Pezzo>}
                <AreaAvvisi />
              </div>
              {pannelloSopra && <div className="velo-pannello" onClick={chiudiPannello} />}
              {!clotchAi && n.vista !== "nuova-sessione" && n.pannelloAperto && <aside ref={sopraPannello} className={largo ? "pannello" : "pannello sopra"}><Pezzo nome="pannello" centro><Pannello /></Pezzo></aside>}
            </div>
          </div>
        </main>
      </div>
      <Pezzo nome="barra"><RicercaGlobale /></Pezzo>
      {/* barra sopra la colonna (101:29552): velo su tutta la finestra, barra del titolo compresa */}
      {barraSopra && (
        <>
          <div className="velo-barra" onClick={chiudiBarra} />
          <nav className="barra-laterale sopra" ref={sopra}><Pezzo nome="barra" centro><Barra /></Pezzo></nav>
        </>
      )}
    </>
  );
}

function Guscio() {
  const avvio = useCoperto();
  return (
    <div className={`cornice ${avvio ? "in-avvio" : ""}`}>
      <BarraTitolo inerte={avvio} />
      <Corpo />
      <Avvio fine={!avvio} />
      <Pezzo nome="dialoghi"><Dialoghi /></Pezzo>
    </div>
  );
}

export function Cornice() {
  useAspetto();
  return <ConNavigazione><Guscio /></ConNavigazione>;
}

/** Superficie con bordo, come «Superficie» del frame: per i pezzi che disegnano una pagina intera (impostazioni). */
export function Superficie({ children }: { children: React.ReactNode }) {
  return <div className="area-principale" tabIndex={-1}><div className="superficie">{children}</div></div>;
}
