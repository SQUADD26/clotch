// figma: 101-17716 — Impostazioni · Scorciatoie; registrazione (in ascolto, tasti già usati, non assegnata): 101-33015.
import { useEffect, useRef, useState } from "react";
import { Bottone } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { Gruppo, Pagina, Tasto } from "./controlli";
import { prova } from "./prova";
import { imposta, useImpostazioni } from "./stato";
import { riservatoDa } from "./riservati";
import { AZIONI, nomeAzione, normalizza, tastiDi } from "./tasti";

const nome = nomeAzione;

interface Conflitto { azione: string; tasti: string; con: string }

// una scorciatoia senza ⌘, ⌃ o ⌥ scatterebbe mentre scrivi (tranne i tasti funzione): non si registra (#948)
const conModificatore = (e: KeyboardEvent) => e.metaKey || e.ctrlKey || e.altKey || /^F\d{1,2}$/.test(e.key);
const tastoRiga = (azione: string) => document.querySelector<HTMLElement>(`[data-azione="${azione}"]`) ?? document.querySelector<HTMLElement>(".pezzo-impostazioni .conflitto button");

export default function Scorciatoie() {
  const v = useImpostazioni();
  const [ascolta, setAscolta] = useState<string | null>(prova?.registrazione ? "ferma" : null);
  const [conflitto, setConflitto] = useState<Conflitto | null>(prova?.registrazione ? { azione: "nega", tasti: "⌘K", con: "cerca" } : null);
  const [senzaModificatore, setSenzaModificatore] = useState(false);
  const fuoco = useRef<string | null>(null); // la riga che riprende il fuoco quando la registrazione o il conflitto finiscono (#949)
  useEffect(() => { if (fuoco.current && !ascolta) { tastoRiga(fuoco.current)?.focus(); fuoco.current = null; } });
  const tasti = prova?.registrazione ? { ...v.scorciatoie, barra: null } : v.scorciatoie;

  useEffect(() => {
    if (!ascolta || prova) return;
    const premi = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const fine = () => { fuoco.current = ascolta; setAscolta(null); setSenzaModificatore(false); };
      // Esc, Tab e ⇧Tab escono senza cambiare niente: la registrazione non è una trappola (#948)
      if (e.key === "Escape" || e.key === "Tab") return fine();
      const nudo = !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
      if (nudo && (e.key === "Backspace" || e.key === "Delete")) { fine(); setConflitto(null); return imposta("scorciatoie", { ...v.scorciatoie, [ascolta]: null }); } // ⌫ da solo: «Non assegnata»
      const t = tastiDi(e);
      if (!t) return;
      if (!conModificatore(e)) return setSenzaModificatore(true);
      fine();
      const con = Object.entries(v.scorciatoie).find(([a, x]) => normalizza(x) === t && a !== ascolta)?.[0] ?? riservatoDa(t); // `nome()` lascia com'è ciò che non è un'azione modificabile
      if (con) setConflitto({ azione: ascolta, tasti: t, con });
      else { setConflitto(null); imposta("scorciatoie", { ...v.scorciatoie, [ascolta]: t }); }
    };
    const fuori = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".in-ascolto")) setAscolta(null); }; // un clic altrove annulla l'ascolto
    addEventListener("keydown", premi, true); // prima delle scorciatoie dell'app
    addEventListener("mousedown", fuori, true);
    return () => { removeEventListener("keydown", premi, true); removeEventListener("mousedown", fuori, true); };
  }, [ascolta, v.scorciatoie]);

  // Esc chiude anche il conflitto: resta il tasto di prima (#949)
  useEffect(() => {
    if (!conflitto || ascolta || prova) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); annulla(conflitto); } };
    addEventListener("keydown", esc, true);
    return () => removeEventListener("keydown", esc, true);
  });

  const registra = (azione: string) => { setConflitto(null); setSenzaModificatore(false); setAscolta(azione); };
  const sostituisci = (c: Conflitto) => { fuoco.current = c.azione; setConflitto(null); imposta("scorciatoie", { ...v.scorciatoie, [c.con]: null, [c.azione]: c.tasti }); };
  const annulla = (c: Conflitto) => { fuoco.current = c.azione; setConflitto(null); };

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
                  <span className="t-sm errore" role="alert">Già usata da «{nome(c.con)}»</span>
                  <Bottone tipo="secondario" onClick={() => annulla(c)}>Annulla</Bottone>
                  {AZIONI.some(([a]) => a === c.con) && <Bottone tipo="secondario" onClick={() => sostituisci(c)}>Sostituisci</Bottone>}
                </div>
              )}
              {ascolta === azione ? <span className="tasto-chip in-ascolto" role="status" aria-live="polite" aria-label={`${etichetta}: ${senzaModificatore ? "aggiungi ⌘, ⌃ o ⌥" : "premi i tasti, ⌫ per toglierla, Esc per annullare"}`}>{senzaModificatore ? "Aggiungi ⌘, ⌃ o ⌥" : "Premi i tasti…"}</span>
                : c ? <Tasto tasti={c.tasti} errore />
                : t ? <button type="button" data-azione={azione} aria-label={`Cambia ${etichetta}`} onClick={() => registra(azione)}><Tasto tasti={t} /></button>
                : (
                  <>
                    <span className="t-sm secondario">Non assegnata</span>
                    <button type="button" data-azione={azione} aria-label={`Assegna ${etichetta}`} onClick={() => registra(azione)}><Icona nome="matita" /></button>
                  </>
                )}
            </div>
          );
        })}
      </Gruppo>
    </Pagina>
  );
}
