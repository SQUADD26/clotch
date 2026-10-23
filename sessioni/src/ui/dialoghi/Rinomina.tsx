// figma: 101-22044 — «Dialogo: rinomina sessione»: campo col nome, nota, Annulla e Salva. Lo usa anche «Rinomina etichetta…» di una cartella.
import { useState } from "react";
import { Bottone } from "../base/Bottone";
import { Dialogo } from "../base/Dialogo";
import { chiudiDialogo, type DatiDialoghi } from "../base/dialoghi";

/** Salva il nome scritto (senza spazi ai bordi; vuoto = torna il nome di prima) e chiude. */
export function DialogoRinomina({ titolo, valore, nota, salva }: DatiDialoghi["rinomina"]) {
  const [testo, setTesto] = useState(valore);
  const fai = () => { salva(testo.trim()); chiudiDialogo(); };
  return (
    <Dialogo titolo={titolo} onChiudi={chiudiDialogo}
      bottoni={<><Bottone tipo="secondario" onClick={chiudiDialogo}>Annulla</Bottone><Bottone onClick={fai}>Salva</Bottone></>}>
      <input className="campo-nome" value={testo} aria-label={titolo} autoFocus onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) fai(); }} />
      <div className="t-sm secondario">{nota}</div>
    </Dialogo>
  );
}
