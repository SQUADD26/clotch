// figma: 101-30172 — «Bottone attività» 121:58595 (Senza numero, Con numero, Aperto) e «Popover attività» 163:83962 (Vuoto 121:58601, Con sessioni 163:83903)
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Registro } from "../../clotch-ai";
import { useApriSessione } from "../barra/apri";
import { durata } from "../chat/testi";
import { useRegistro } from "../clotch-ai/dati";
import { casella } from "../clotch-ai/vista";
import { BottoneIcona } from "./Bottone";
import { usePreferenze } from "./dati";
import { Icona } from "./Icona";
import { IconaSessione } from "./IconaSessione";
import { useNavigazione } from "./navigazione";
import { Sovrapposto, type Punto } from "./Sovrapposto";
import { numero } from "./token";
import "./attivita.css";

/** Sotto l'intestazione della sessione, a destra della barra laterale: non copre il titolo (101:30172). */
function punto(): Punto {
  const s = document.querySelector(".superficie")?.getBoundingClientRect() ?? new DOMRect();
  return { x: s.left + numero("spazio-2"), y: s.top + numero("misura-intestazione") + numero("spazio-2") };
}

// ↑ e ↓ passano da una riga all'altra (HIG: una lista si scorre con le frecce)
const frecce = (e: KeyboardEvent<HTMLDivElement>) => {
  const passo = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
  const righe = [...e.currentTarget.querySelectorAll<HTMLElement>(".riga-attesa")], i = righe.indexOf(document.activeElement as HTMLElement);
  if (!passo || !righe.length) return;
  e.preventDefault();
  righe[Math.min(righe.length - 1, Math.max(0, i + passo))].focus();
};

/** Campana nella barra del titolo: il numero è quello di «Casella» (sessioni che aspettano te); il clic apre e chiude il popover; la X, Esc e un clic fuori lo chiudono. */
export function Attivita() {
  const r = useRegistro();
  // nella prova di parità del frame 101-30172 il popover parte aperto, come nel disegno
  const [aperto, setAperto] = useState(() => new URLSearchParams(location.search).get("parita") === "101-30172");
  // la barra che si apre o si chiude (⌘\) sposta il punto in cui sta: si chiude (#544)
  const { barraAperta, sessione } = useNavigazione(), barraPrima = useRef(barraAperta);
  const pref = usePreferenze().dati, apriSessione = useApriSessione();
  useEffect(() => { if (barraPrima.current !== barraAperta) { barraPrima.current = barraAperta; setAperto(false); } }, [barraAperta]);
  const attese = r.dati ? casella(r.dati as Registro, Date.now()).progetti.flatMap((p) => p.aspettano) : [];
  const n = attese.length;
  return (
    <>
      <div className="bottone-attivita">
        <BottoneIcona icona="campana" etichetta={n > 0 ? `Mostra attività, ${n} in attesa` : "Mostra attività"} aria-expanded={aperto} className={aperto ? "aperto" : ""} onClick={() => setAperto(!aperto)} />
        {n > 0 && <span className="contatore t-xs medio" aria-hidden>{n}</span>}
      </div>
      {aperto && (
        <Sovrapposto ancora={punto()} className={n ? "popover-attivita con-sessioni" : "popover-attivita"} role="dialog" label="Attività" onChiudi={() => setAperto(false)}>
          <div className="testata">
            <span className="medio">Attività</span>
            <button type="button" aria-label="Chiudi" title="Chiudi" onClick={() => setAperto(false)}><Icona nome="chiudi" /></button>
          </div>
          {n === 0 ? <div className="t-sm secondario">Qui trovi le sessioni che aspettano te: permessi, domande e piani da approvare.</div> : (
            <div className="elenco" onKeyDown={frecce}>
              {attese.map((a) => (
                <button key={a.chat} type="button" className="riga-attesa" aria-current={a.chat === sessione || undefined}
                  onClick={() => { setAperto(false); apriSessione(a.chat); }}>
                  <IconaSessione icona={pref?.[a.chat]?.icona} colore={pref?.[a.chat]?.colore} />
                  <span className="titolo t-base">{pref?.[a.chat]?.nome ?? a.titolo}</span>
                  <span className="t-sm secondario">{a.genere}</span>
                  {/* «12 min»: minuti interi, almeno 1 */}
                  {a.da != null && <span className="t-sm secondario">{durata(Math.max(60_000, Math.floor((Date.now() - a.da) / 60_000) * 60_000))}</span>}
                </button>
              ))}
            </div>
          )}
        </Sovrapposto>
      )}
    </>
  );
}
