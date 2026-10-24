// Un'azione che aspetta l'esito dal motore (fino a 30 s): finché non torna, la stessa carta non ne accetta un'altra.
import { useRef, useState } from "react";

/** `fai(f)` esegue `f` una volta alla volta; `inCorso` serve a spegnere i bottoni. Il ref chiude anche il doppio clic nello stesso istante. */
export function useInCorso() {
  const [inCorso, setInCorso] = useState(false);
  const occupato = useRef(false);
  const fai = async <T,>(f: () => Promise<T>): Promise<T | undefined> => {
    if (occupato.current) return undefined;
    occupato.current = true; setInCorso(true);
    try { return await f(); } finally { occupato.current = false; setInCorso(false); }
  };
  return { inCorso, fai };
}
