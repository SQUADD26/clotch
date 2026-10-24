// figma: 119-57161 — «Impostazioni · Ricerca: risultati»; senza risultati: 119-57301. Il campo è la voce «Cerca» della navigazione.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Icona } from "../base/Icona";
import { useNavigazione } from "../base/navigazione";
import { registraAzione } from "../base/scorciatoie";
import { cerca, type Voce } from "./voci-ricerca";
import { SEZIONI, type Sezione } from "./sezioni";
import "./ricerca.css";

const sezioneDi = (v: Voce) => SEZIONI.find(([id]) => id === v.sezione)!;

/** La voce «Cerca» (un campo) e, se c'è un testo, sotto i risultati o «Nessuna impostazione per …». */
export function Ricerca({ testo, onTesto, sezione }: { testo: string; onTesto(t: string): void; sezione: Sezione }) {
  const n = useNavigazione();
  const trovate = useMemo(() => cerca(testo), [testo]);
  const [scelto, setScelto] = useState(0);
  const attiva = trovate[scelto];
  const campo = useRef<HTMLInputElement>(null);
  // il tasto di «Cerca nella sessione» (⌘F di serie) qui porta al campo, come in ogni finestra del Mac (HIG Search fields)
  useEffect(() => registraAzione("trova", () => { campo.current?.focus(); campo.current?.select(); }), []);
  const apri = (i: number) => { setScelto(i); n.apri("impostazioni", undefined, trovate[i].sezione); };
  // la riga della pagina aperta che il risultato attivo indica
  useEffect(() => {
    if (!attiva || attiva.sezione !== sezione) return;
    const riga = [...document.querySelectorAll<HTMLElement>(".gruppo > .riga")]
      .find((r) => r.querySelector(".testi > div")?.textContent === attiva.etichetta);
    riga?.classList.add("evidenziata");
    return () => riga?.classList.remove("evidenziata");
  }, [attiva, sezione]);
  const tasto = (e: KeyboardEvent) => {
    if (e.key === "Escape") onTesto("");
    else if (!trovate.length) return;
    else if (e.key === "Enter") apri(scelto);
    else if (e.key === "ArrowDown") setScelto((scelto + 1) % trovate.length);
    else if (e.key === "ArrowUp") setScelto((scelto + trovate.length - 1) % trovate.length);
    else return;
    e.preventDefault();
  };
  const t = testo.trim();
  return (
    <>
      <label className={`voce cerca-voce ${t ? "piena" : ""}`}>
        <Icona nome="cerca" />
        <input ref={campo} value={testo} placeholder="Cerca" aria-label="Cerca nelle impostazioni" spellCheck={false}
          role="combobox" aria-expanded={!!t && trovate.length > 0} aria-controls="risultati-impostazioni" aria-activedescendant={t && attiva ? `risultato-${scelto}` : undefined}
          onChange={(e) => { onTesto(e.target.value); setScelto(0); }} onKeyDown={tasto} />
      </label>
      {t && (
        <div className="risultati" id="risultati-impostazioni" role="listbox" aria-label="Risultati">
          {trovate.length === 0 ? (
            <div className="nessun-risultato">
              <div className="t-sm medio">Nessuna impostazione per «{t}»</div>
              <div className="t-xs secondario">Prova con altre parole.</div>
            </div>
          ) : (
            <>
              <div className="titolo-gruppo t-xs medio secondario">{trovate.length === 1 ? "1 risultato" : `${trovate.length} risultati`}</div>
              {trovate.map((v, i) => (
                <button key={`${v.sezione}/${v.etichetta}`} id={`risultato-${i}`} type="button" role="option" aria-selected={i === scelto} tabIndex={-1} className={`risultato ${i === scelto ? "attivo" : ""}`} onClick={() => apri(i)}>
                  <Icona nome={sezioneDi(v)[2]} />
                  <span className="testi-risultato">
                    <span className="t-sm">{v.etichetta}</span>
                    <span className="t-xs secondario">{v.etichetta === sezioneDi(v)[1] ? "Sezione" : sezioneDi(v)[1]}</span>
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}
