// figma: 101-17716 — Impostazioni · Scorciatoie; registrazione (in ascolto, tasti già usati, non assegnata): 101-33015.
import { useEffect, useState } from "react";
import { Bottone } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { Gruppo, Pagina, Tasto } from "./controlli";
import { prova } from "./prova";
import { imposta, useImpostazioni } from "./stato";
import { AZIONI, nomeAzione, normalizza, tastiDi } from "./tasti";

const nome = nomeAzione;

interface Conflitto { azione: string; tasti: string; con: string }

export default function Scorciatoie() {
  const v = useImpostazioni();
  const [ascolta, setAscolta] = useState<string | null>(prova?.registrazione ? "ferma" : null);
  const [conflitto, setConflitto] = useState<Conflitto | null>(prova?.registrazione ? { azione: "nega", tasti: "⌘K", con: "cerca" } : null);
  const tasti = prova?.registrazione ? { ...v.scorciatoie, barra: null } : v.scorciatoie;

  useEffect(() => {
    if (!ascolta || prova) return;
    const premi = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return setAscolta(null);
      const t = tastiDi(e);
      if (!t) return;
      setAscolta(null);
      const con = Object.entries(v.scorciatoie).find(([a, x]) => x === t && a !== ascolta)?.[0];
      if (con) setConflitto({ azione: ascolta, tasti: t, con });
      else { setConflitto(null); imposta("scorciatoie", { ...v.scorciatoie, [ascolta]: t }); }
    };
    const fuori = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".in-ascolto")) setAscolta(null); }; // un clic altrove annulla l'ascolto
    addEventListener("keydown", premi, true); // prima delle scorciatoie dell'app
    addEventListener("mousedown", fuori, true);
    return () => { removeEventListener("keydown", premi, true); removeEventListener("mousedown", fuori, true); };
  }, [ascolta, v.scorciatoie]);

  const registra = (azione: string) => { setConflitto(null); setAscolta(azione); };
  const sostituisci = (c: Conflitto) => { setConflitto(null); imposta("scorciatoie", { ...v.scorciatoie, [c.con]: null, [c.azione]: c.tasti }); };

  return (
    <Pagina titolo="Scorciatoie">
      <Gruppo>
        {AZIONI.map(([azione, etichetta]) => {
          const c = conflitto?.azione === azione ? conflitto : null;
          const t = normalizza(tasti[azione]);
          return (
            <div key={azione} className="riga">
              <div className="testi"><div className="t-base">{etichetta}</div></div>
              {c && (
                <div className="conflitto">
                  <span className="t-sm errore">Già usata da «{nome(c.con)}»</span>
                  <Bottone tipo="secondario" onClick={() => sostituisci(c)}>Sostituisci</Bottone>
                </div>
              )}
              {ascolta === azione ? <span className="tasto-chip in-ascolto">Premi i tasti…</span>
                : c ? <Tasto tasti={c.tasti} errore />
                : t ? <button type="button" aria-label={`Cambia ${etichetta}`} onClick={() => registra(azione)}><Tasto tasti={t} /></button>
                : (
                  <>
                    <span className="t-sm secondario">Non assegnata</span>
                    <button type="button" aria-label={`Assegna ${etichetta}`} onClick={() => registra(azione)}><Icona nome="matita" /></button>
                  </>
                )}
            </div>
          );
        })}
      </Gruppo>
    </Pagina>
  );
}
