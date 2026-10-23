// figma: 101-8036 — «Sessione aperta · 1440» (e 101-8610 a 1024): barra del titolo e tre colonne con i punti di montaggio.
import { useEffect, useRef, useState } from "react";
import Barra from "../barra";
import Chat, { Intestazione as IntestazioneChat } from "../chat";
import Friday, { Intestazione as IntestazioneFriday } from "../friday";
import Impostazioni from "../impostazioni";
import Pannello from "../pannello";
import { AreaAvvisi } from "./Avvisi";
import { BarraTitolo } from "./BarraTitolo";
import { ConNavigazione, useNavigazione } from "./navigazione";
import { numero } from "./token";
import "./cornice.css";

// Il pannello sta accanto alla colonna solo se c'è posto per entrambi (a 1440 sì, a 1024 no, come nei due frame).
const LARGHEZZA_PANNELLO = numero("misura-colonna") + numero("misura-pannello") + 3 * numero("spazio-4");

function useLargo(ref: React.RefObject<HTMLElement | null>) {
  const [largo, setLargo] = useState(true);
  useEffect(() => {
    const o = new ResizeObserver(([e]) => setLargo(e.contentRect.width + 2 * numero("spazio-4") >= LARGHEZZA_PANNELLO));
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, [ref]);
  return largo;
}

function Corpo() {
  const n = useNavigazione();
  const contenuto = useRef<HTMLDivElement>(null);
  const largo = useLargo(contenuto);
  if (n.vista === "impostazioni") return <div className="corpo"><Impostazioni /></div>;
  const friday = n.vista === "friday";
  return (
    <div className="corpo">
      {n.barraAperta && <nav className="barra-laterale"><Barra /></nav>}
      <main className="area-principale">
        <div className="superficie">
          {friday ? <IntestazioneFriday /> : <IntestazioneChat />}
          <div className="contenuto" ref={contenuto}>
            <div className="colonna">
              {friday ? <Friday /> : <Chat />}
              <AreaAvvisi />
            </div>
            {!friday && n.pannelloAperto && largo && <aside className="pannello"><Pannello /></aside>}
          </div>
        </div>
      </main>
    </div>
  );
}

export function Cornice() {
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
