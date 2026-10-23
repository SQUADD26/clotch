// figma: 101-8036 — «Sessione aperta · 1440» (e 101-8610 a 1024): barra del titolo e tre colonne con i punti di montaggio.
import { useEffect, useRef, useState } from "react";
import Barra from "../barra";
import Chat, { Intestazione as IntestazioneChat } from "../chat";
import Friday, { Intestazione as IntestazioneFriday } from "../friday";
import Impostazioni from "../impostazioni";
import Pannello from "../pannello";
import { AreaAvvisi } from "./Avvisi";
import { useAspetto } from "./aspetto";
import { BarraTitolo } from "./BarraTitolo";
import { Pezzo } from "./Pezzo";
import { ConNavigazione, useNavigazione, VISTE_FRIDAY } from "./navigazione";
import { useScorciatoie } from "./scorciatoie";
import { numero } from "./token";
import "./cornice.css";
import "./aspetto.css";

// Il pannello sta accanto alla colonna solo se c'è posto per entrambi (a 1440 sì, a 1024 no, come nei due frame).
const LARGHEZZA_PANNELLO = numero("misura-colonna") + numero("misura-pannello") + 3 * numero("spazio-4");

function useLargo(ref: React.RefObject<HTMLElement | null>, visibile: boolean) {
  const [largo, setLargo] = useState(true);
  useEffect(() => {
    if (!visibile) return;
    const o = new ResizeObserver(([e]) => setLargo(e.contentRect.width + 2 * numero("spazio-4") >= LARGHEZZA_PANNELLO));
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, [ref, visibile]);
  return largo;
}

function Corpo() {
  const n = useNavigazione();
  useScorciatoie();
  const contenuto = useRef<HTMLDivElement>(null);
  const largo = useLargo(contenuto, n.vista !== "impostazioni");
  if (n.vista === "impostazioni") return <div className="corpo"><Pezzo nome="impostazioni"><Impostazioni /></Pezzo></div>;
  const friday = VISTE_FRIDAY.includes(n.vista);
  return (
    <div className="corpo">
      {n.barraAperta && <nav className="barra-laterale"><Pezzo nome="barra"><Barra /></Pezzo></nav>}
      <main className="area-principale">
        <div className="superficie">
          {friday ? <Pezzo nome="friday"><IntestazioneFriday /></Pezzo> : <Pezzo nome="chat"><IntestazioneChat /></Pezzo>}
          <div className="contenuto" ref={contenuto}>
            <div className="colonna">
              {friday ? <Pezzo nome="friday"><Friday /></Pezzo> : <Pezzo nome="chat"><Chat /></Pezzo>}
              <AreaAvvisi />
            </div>
            {!friday && n.pannelloAperto && largo && <aside className="pannello"><Pezzo nome="pannello"><Pannello /></Pezzo></aside>}
          </div>
        </div>
      </main>
    </div>
  );
}

export function Cornice() {
  useAspetto();
  return (
    <ConNavigazione>
      <div className="cornice">
        <BarraTitolo />
        <Corpo />
      </div>
    </ConNavigazione>
  );
}

/** Superficie con bordo, come «Superficie» del frame: per i pezzi che disegnano una pagina intera (impostazioni). */
export function Superficie({ children }: { children: React.ReactNode }) {
  return <div className="area-principale"><div className="superficie">{children}</div></div>;
}
