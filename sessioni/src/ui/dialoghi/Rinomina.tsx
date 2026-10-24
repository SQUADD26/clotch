// figma: 101-22044 — «Dialogo: rinomina sessione»: campo col nome, nota, Annulla e Salva. Lo usa anche «Rinomina etichetta…» di una cartella.
import { useState } from "react";
import { Bottone } from "../base/Bottone";
import { Dialogo } from "../base/Dialogo";
import { chiudiDialogo, type DatiDialoghi } from "../base/dialoghi";

const LIMITE = 120;

/** Salva il nome scritto (senza spazi ai bordi) e chiude; col campo vuoto Salva toglie il nome scelto e la nota dice cosa torna. */
export function DialogoRinomina({ titolo, valore, nota, vuoto: tornaA = "Torna al nome originale.", salva }: DatiDialoghi["rinomina"]) {
  const [testo, setTesto] = useState(valore);
  const vuoto = !testo.trim(), cambiato = testo.trim() !== valore.trim();
  const lungo = testo.trim().length > LIMITE;
  const fai = () => { if (!lungo) { salva(testo.trim()); chiudiDialogo(); } };
  return (
    <Dialogo titolo={titolo} onChiudi={chiudiDialogo}
      bottoni={<><Bottone tipo="secondario" onClick={chiudiDialogo}>Annulla</Bottone><Bottone disabled={lungo} onClick={fai}>Salva</Bottone></>}>
      <input className="campo-nome" value={testo} aria-label={titolo} autoFocus title={testo.length > 40 ? testo : undefined} aria-invalid={lungo || undefined} onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) fai(); }} />
      <div className={lungo ? "t-sm errore-ore" : "t-sm secondario"} role={lungo ? "alert" : undefined}>{lungo ? `Il nome ha ${testo.trim().length} caratteri: al massimo ${LIMITE}.` : vuoto && cambiato ? tornaA : nota}</div>
    </Dialogo>
  );
}
