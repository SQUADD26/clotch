// figma: 101-30172 — «Bottone attività» 121:58595 (Senza numero, Con numero, Aperto) e «Popover attività» 121:58601
import { useState } from "react";
import type { Registro } from "../../friday";
import { useRegistro } from "../friday/dati";
import { casella } from "../friday/vista";
import { BottoneIcona } from "./Bottone";
import { Icona } from "./Icona";
import "./attivita.css";

/** Campana nella barra del titolo: il numero è quello di «Casella» (sessioni che aspettano te); il clic apre e chiude il popover. */
export function Attivita() {
  const r = useRegistro();
  // nella prova di parità del frame 101-30172 il popover parte aperto, come nel disegno
  const [aperto, setAperto] = useState(() => new URLSearchParams(location.search).get("parita") === "101-30172");
  const n = r.dati ? casella(r.dati as Registro, Date.now()).aspettano : 0;
  return (
    <>
      <div className="bottone-attivita">
        <BottoneIcona icona="campana" etichetta="Attività" aria-expanded={aperto} className={aperto ? "aperto" : ""} onClick={() => setAperto(!aperto)} />
        {n > 0 && <span className="contatore t-xs medio">{n}</span>}
      </div>
      {aperto && (
        <div className="popover-attivita" role="dialog" aria-label="Attività">
          <div className="testata">
            <span className="medio">Attività</span>
            <button type="button" aria-label="Chiudi" title="Chiudi" onClick={() => setAperto(false)}><Icona nome="chiudi" /></button>
          </div>
          <div className="t-sm secondario">Qui trovi le sessioni che aspettano te: permessi, domande e piani da approvare.</div>
        </div>
      )}
    </>
  );
}
