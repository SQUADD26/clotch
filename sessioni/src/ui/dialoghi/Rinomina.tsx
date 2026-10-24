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
  const lungo = testo.trim().length > LIMITE;
  const fai = () => { if (!vuoto && !lungo) { salva(testo.trim()); chiudiDialogo(); } };
  return (
    <Dialogo titolo={titolo} onChiudi={chiudiDialogo}
      bottoni={<><Bottone tipo="secondario" onClick={chiudiDialogo}>Annulla</Bottone><Bottone disabled={vuoto || lungo} onClick={fai}>Salva</Bottone></>}>
      <input className="campo-nome" value={testo} aria-label={titolo} autoFocus title={testo.length > 40 ? testo : undefined} aria-invalid={vuoto || lungo || undefined} onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) fai(); }} />
      <div className={vuoto || lungo ? "t-sm errore-ore" : "t-sm secondario"} role={vuoto || lungo ? "alert" : undefined}>{vuoto ? "Scrivi un nome." : lungo ? `Il nome ha ${testo.trim().length} caratteri: al massimo ${LIMITE}.` : nota}</div>
    </Dialogo>
  );
}
