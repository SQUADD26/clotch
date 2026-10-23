// figma: 101-36642 — «prima apertura»: la chat con clotch AI è vuota; titolo, riga di aiuto e tre domande da un clic.
// Le domande nominano i progetti veri del registro; un clic manda il comando `parla` come se Roberto l'avesse scritta.
import { comanda } from "../chat/friday";
import { useRegistro } from "./dati";
import { suggerimenti } from "./vista";

export function PrimaApertura() {
  const { dati: r } = useRegistro();
  const voci = r ? suggerimenti(r, Date.now()) : [];
  return (
    <div className="prima-apertura">
      <h2 className="titolo">Cosa vuoi sapere?</h2>
      <p className="t-sm secondario">clotch AI vede tutte le sessioni. Chiedi a voce o scrivendo.</p>
      <div className="suggerimenti">
        {voci.map((t) => <button key={t} type="button" className="suggerimento t-sm" onClick={() => void comanda("parla", { testo: t })}>{t}</button>)}
      </div>
    </div>
  );
}
