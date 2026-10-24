// figma: 101-24069 — «tooltip» 101:24123: sotto il bottone, il nome dell'azione e (nel «tasto») la sua scorciatoia, per esempio «Nascondi barra laterale ⌘\».
// Compare dopo una breve attesa al passaggio del mouse e subito col fuoco da tastiera; sparisce al clic e quando si esce.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Sovrapposto, type Lato } from "./Sovrapposto";
import { numero } from "./token";
import "./suggerimento.css";

const ATTESA_MS = 500;

/** `forzato`: sempre visibile (scena di prova 101-24069). `lato` (con `allinea` e `scarto`): appoggiato al bottone da quel lato, come i suggerimenti
 *  della chat (101:43945, 101:26425); senza, sotto e spostato di spazio-2 a sinistra come in 101:24123. `classe`: lo stile del pezzo («suggerimento» nella chat). `nascosto`: il controllo ha aperto il suo menu, che sta nello stesso punto. */
export function Suggerimento({ testo, scorciatoia, forzato = false, lato, allinea, scarto, classe = "tooltip", nascosto = false, children }: {
  testo: string; scorciatoia?: string | null; forzato?: boolean; lato?: Lato; allinea?: "fine" | "centro"; scarto?: number; classe?: string; nascosto?: boolean; children: ReactNode;
}) {
  const [visibile, setVisibile] = useState(false);
  const [el, setEl] = useState<HTMLSpanElement | null>(null);
  const timer = useRef(0);
  const apri = () => { clearTimeout(timer.current); timer.current = window.setTimeout(() => setVisibile(true), ATTESA_MS); };
  const chiudi = () => { clearTimeout(timer.current); setVisibile(false); };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <span ref={setEl} className="con-tooltip" onMouseEnter={apri} onMouseLeave={chiudi} onMouseDown={chiudi} onKeyDown={(e) => { if (e.key === "Escape") chiudi(); }}
      onFocus={(e) => { if (e.target.matches(":focus-visible")) setVisibile(true); }} onBlur={chiudi}>
      {children}
      {(visibile || forzato) && !nascosto && el && (
        <Sovrapposto passivo className={classe} role="tooltip" lato={lato} fine={allinea === "fine"} centro={allinea === "centro"} scarto={scarto}
          ancora={lato ? el : { x: el.getBoundingClientRect().left - numero("spazio-2"), y: el.getBoundingClientRect().bottom + numero("spazio-1-5") }}>
          <span>{testo}</span>
          {scorciatoia && <span className="tasto-chip">{scorciatoia}</span>}
        </Sovrapposto>
      )}
    </span>
  );
}
