// figma: 101-8036 — «Sessione aperta · 1440» (e 101-8610 a 1024): barra del titolo e tre colonne con i punti di montaggio.
// Finestre strette e barra ridimensionabile: 101-29280, 101-29399, 101-29552, 101-29770, 101-29971 (base/layout.tsx).
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import Barra from "../barra";
import Chat, { Intestazione as IntestazioneChat } from "../chat";
import { Dialoghi } from "../dialoghi";
import ClotchAi, { Intestazione as IntestazioneClotchAi } from "../clotch-ai";
import Impostazioni from "../impostazioni";
import Pannello from "../pannello";
import { AreaAvvisi } from "./Avvisi";
import { Avvio, useAvvio } from "./Avvio";
import { useAspetto } from "./aspetto";
import { BarraTitolo } from "./BarraTitolo";
import { Pezzo } from "./Pezzo";
import { LARGHEZZA_BARRA_FISSA, ManigliaBarra, useEscChiude, useLarghezza, useLarghezzaBarra } from "./layout";
import { ConNavigazione, useNavigazione, VISTE_CLOTCH_AI } from "./navigazione";
import { useScorciatoie } from "./scorciatoie";
import { numero } from "./token";
import "./cornice.css";
import "./aspetto.css";

// Il pannello sta accanto alla colonna solo se c'è posto per entrambi (a 1440 sì, a 1024 no, come nei due frame).
const LARGHEZZA_PANNELLO = numero("misura-colonna") + numero("misura-pannello") + 3 * numero("spazio-4");

function Corpo() {
  const n = useNavigazione();
  useScorciatoie();
  const corpo = useRef<HTMLDivElement>(null), colonna = useRef<HTMLDivElement>(null), contenuto = useRef<HTMLDivElement>(null);
  const impostazioni = n.vista === "impostazioni";
  const finestra = useLarghezza(corpo), larghezzaColonna = useLarghezza(colonna, !impostazioni);
  const largo = useLarghezza(contenuto, !impostazioni) >= LARGHEZZA_PANNELLO;
  const barra = useLarghezzaBarra();
  // finestra stretta (101:29552): la barra sta sopra; colonna sotto la bolla piena (101:29770): casella compatta
  const stretta = finestra > 0 && finestra < LARGHEZZA_BARRA_FISSA;
  const compatta = larghezzaColonna > 0 && larghezzaColonna < numero("misura-bolla-max");
  const { adatta } = n;
  useLayoutEffect(() => adatta(stretta, largo), [adatta, stretta, largo]);
  useEscChiude(n.sovrapposta && n.barraAperta, n.alternaBarra);
  useEscChiude(!largo && n.pannelloAperto, n.chiudiPannello);
  const attributi = { ref: corpo, inert: useAvvio() || undefined, "data-compatta": compatta || undefined, style: { "--larghezza-barra": `${barra.w}px` } as CSSProperties };
  if (impostazioni) return <div className="corpo" {...attributi}><Pezzo nome="impostazioni"><Impostazioni /></Pezzo></div>;
  const clotchAi = VISTE_CLOTCH_AI.includes(n.vista);
  const fissa = n.barraAperta && !n.sovrapposta;
  return (
    <>
      <div className="corpo" {...attributi}>
        {fissa && <nav className="barra-laterale"><Pezzo nome="barra"><Barra /></Pezzo></nav>}
        {fissa && <ManigliaBarra corpo={corpo} {...barra} />}
        <main className="area-principale">
          <div className="superficie">
            {clotchAi ? <Pezzo nome="clotch-ai"><IntestazioneClotchAi /></Pezzo> : <Pezzo nome="chat"><IntestazioneChat /></Pezzo>}
            <div className="contenuto" ref={contenuto}>
              <div className="colonna" ref={colonna}>
                {clotchAi ? <Pezzo nome="clotch-ai"><ClotchAi /></Pezzo> : <Pezzo nome="chat"><Chat /></Pezzo>}
                <AreaAvvisi />
              </div>
              {!clotchAi && n.vista !== "nuova-sessione" && n.pannelloAperto && <aside className={largo ? "pannello" : "pannello sopra"}><Pezzo nome="pannello"><Pannello /></Pezzo></aside>}
            </div>
          </div>
        </main>
      </div>
      {/* barra sopra la colonna (101:29552): velo su tutta la finestra, barra del titolo compresa */}
      {n.sovrapposta && n.barraAperta && (
        <>
          <div className="velo-barra" onClick={n.alternaBarra} />
          <nav className="barra-laterale sopra"><Pezzo nome="barra"><Barra /></Pezzo></nav>
        </>
      )}
    </>
  );
}

export function Cornice() {
  useAspetto();
  const avvio = useAvvio();
  return (
    <ConNavigazione>
      <div className={`cornice ${avvio ? "in-avvio" : ""}`}>
        <BarraTitolo inerte={avvio} />
        <Corpo />
        <Avvio fine={!avvio} />
        <Pezzo nome="dialoghi"><Dialoghi /></Pezzo>
      </div>
    </ConNavigazione>
  );
}

/** Superficie con bordo, come «Superficie» del frame: per i pezzi che disegnano una pagina intera (impostazioni). */
export function Superficie({ children }: { children: React.ReactNode }) {
  return <div className="area-principale"><div className="superficie">{children}</div></div>;
}
