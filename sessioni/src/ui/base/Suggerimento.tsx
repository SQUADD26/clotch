// figma: 101-24069 — «tooltip» 101:24123: sotto il bottone, il nome dell'azione e (nel «tasto») la sua scorciatoia, per esempio «Nascondi barra laterale ⌘\».
// Compare dopo una breve attesa al passaggio del mouse e subito col fuoco da tastiera; sparisce al clic e quando si esce.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Sovrapposto } from "./Sovrapposto";
import { numero } from "./token";
import "./suggerimento.css";

const ATTESA_MS = 500;

/** `forzato`: sempre visibile (scena di prova 101-24069). */
export function Suggerimento({ testo, scorciatoia, forzato = false, children }: { testo: string; scorciatoia?: string | null; forzato?: boolean; children: ReactNode }) {
  const [visibile, setVisibile] = useState(false);
  const [el, setEl] = useState<HTMLSpanElement | null>(null);
  const timer = useRef(0);
  const apri = () => { clearTimeout(timer.current); timer.current = window.setTimeout(() => setVisibile(true), ATTESA_MS); };
  const chiudi = () => { clearTimeout(timer.current); setVisibile(false); };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <span ref={setEl} className="con-tooltip" onMouseEnter={apri} onMouseLeave={chiudi} onMouseDown={chiudi}
      onFocus={(e) => { if (e.target.matches(":focus-visible")) setVisibile(true); }} onBlur={chiudi}>
      {children}
      {(visibile || forzato) && el && (
        <Sovrapposto passivo ancora={{ x: el.getBoundingClientRect().left - numero("spazio-2"), y: el.getBoundingClientRect().bottom + numero("spazio-1-5") }}
          className="tooltip" role="tooltip">
          <span>{testo}</span>
          {scorciatoia && <span className="tasto-tooltip">{scorciatoia}</span>}
        </Sovrapposto>
      )}
    </span>
  );
}
