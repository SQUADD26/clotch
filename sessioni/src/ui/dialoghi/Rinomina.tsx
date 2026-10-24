// figma: 101-22044 — «Dialogo: rinomina sessione»: campo col nome, nota, Annulla e Salva. Lo usa anche «Rinomina etichetta…» di una cartella.
import { useState } from "react";
import { Bottone } from "../base/Bottone";
import { Dialogo } from "../base/Dialogo";
import { chiudiDialogo, type DatiDialoghi } from "../base/dialoghi";

const LIMITE = 120;

/** Salva il nome scritto (senza spazi ai bordi; vuoto non si salva) e chiude. */
export function DialogoRinomina({ titolo, valore, nota, salva }: DatiDialoghi["rinomina"]) {
  const [testo, setTesto] = useState(valore);
  const vuoto = !testo.trim();
  const fai = () => { if (!vuoto) { salva(testo.trim()); chiudiDialogo(); } };
  return (
    <Dialogo titolo={titolo} onChiudi={chiudiDialogo}
      bottoni={<><Bottone tipo="secondario" onClick={chiudiDialogo}>Annulla</Bottone><Bottone disabled={vuoto} onClick={fai}>Salva</Bottone></>}>
      <input className="campo-nome" value={testo} aria-label={titolo} autoFocus maxLength={LIMITE} title={testo.length > 40 ? testo : undefined} aria-invalid={vuoto || undefined} onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) fai(); }} />
      <div className={vuoto ? "t-sm errore-ore" : "t-sm secondario"} role={vuoto ? "alert" : undefined}>{vuoto ? "Scrivi un nome." : nota}</div>
    </Dialogo>
  );
}
