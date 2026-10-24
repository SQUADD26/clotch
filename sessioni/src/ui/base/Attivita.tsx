// figma: 101-30172 — «Bottone attività» 121:58595 (Senza numero, Con numero, Aperto) e «Popover attività» 121:58601
import { useEffect, useRef, useState } from "react";
import type { Registro } from "../../clotch-ai";
import { useRegistro } from "../clotch-ai/dati";
import { casella } from "../clotch-ai/vista";
import { BottoneIcona } from "./Bottone";
import { Icona } from "./Icona";
import { useNavigazione } from "./navigazione";
import { Sovrapposto, type Punto } from "./Sovrapposto";
import { numero } from "./token";
import "./attivita.css";

/** Sotto l'intestazione della sessione, a destra della barra laterale: non copre il titolo (101:30172). */
function punto(): Punto {
  const s = document.querySelector(".superficie")?.getBoundingClientRect() ?? new DOMRect();
  return { x: s.left + numero("spazio-2"), y: s.top + numero("misura-intestazione") + numero("spazio-2") };
}

/** Campana nella barra del titolo: il numero è quello di «Casella» (sessioni che aspettano te); il clic apre e chiude il popover; la X, Esc e un clic fuori lo chiudono. */
export function Attivita() {
  const r = useRegistro();
  // nella prova di parità del frame 101-30172 il popover parte aperto, come nel disegno
  const [aperto, setAperto] = useState(() => new URLSearchParams(location.search).get("parita") === "101-30172");
  // la barra che si apre o si chiude (⌘\) sposta il punto in cui sta: si chiude (#544)
  const { barraAperta } = useNavigazione(), barraPrima = useRef(barraAperta);
  useEffect(() => { if (barraPrima.current !== barraAperta) { barraPrima.current = barraAperta; setAperto(false); } }, [barraAperta]);
  const n = r.dati ? casella(r.dati as Registro, Date.now()).aspettano : 0;
  return (
    <>
      <div className="bottone-attivita">
        <BottoneIcona icona="campana" etichetta="Attività" aria-expanded={aperto} className={aperto ? "aperto" : ""} onClick={() => setAperto(!aperto)} />
        {n > 0 && <span className="contatore t-xs medio">{n}</span>}
      </div>
      {aperto && (
        <Sovrapposto ancora={punto()} className="popover-attivita" role="dialog" label="Attività" onChiudi={() => setAperto(false)}>
          <div className="testata">
            <span className="medio">Attività</span>
            <button type="button" aria-label="Chiudi" title="Chiudi" onClick={() => setAperto(false)}><Icona nome="chiudi" /></button>
          </div>
          <div className="t-sm secondario">Qui trovi le sessioni che aspettano te: permessi, domande e piani da approvare.</div>
        </Sovrapposto>
      )}
    </>
  );
}
