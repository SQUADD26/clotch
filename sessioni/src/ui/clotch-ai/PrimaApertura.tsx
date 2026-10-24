// figma: 101-36642 — «prima apertura»: la chat con clotch AI è vuota; titolo, riga di aiuto e tre domande da un clic.
// Le domande nominano i progetti veri del registro; un clic manda il comando `parla` come se Roberto l'avesse scritta.
import { useState } from "react";
import { comanda } from "../chat/clotch-ai";
import { useRegistro } from "./dati";
import { suggerimenti } from "./vista";

export function PrimaApertura({ spenta }: { spenta: boolean }) {
  const { dati: r } = useRegistro();
  const [invio, setInvio] = useState(false); // una domanda alla volta: il filo la mostra appena clotch AI la riceve
  const voci = r ? suggerimenti(r, Date.now()) : [];
  return (
    <div className="prima-apertura">
      <h2 className="titolo">Cosa vuoi sapere?</h2>
      <p className="t-sm secondario">clotch AI vede tutte le sessioni. Chiedi a voce o scrivendo.</p>
      <div className="suggerimenti">
        {voci.map((t) => <button key={t} type="button" className="suggerimento t-sm" disabled={spenta || invio} onClick={() => { setInvio(true); void comanda("parla", { testo: t }).finally(() => setInvio(false)); }}>{t}</button>)}
      </div>
    </div>
  );
}
