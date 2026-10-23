// figma: 101-7712 — «Barra titolo»: posto del semaforo del Mac e navigazione (barra laterale, indietro, avanti).
import { BottoneIcona } from "./Bottone";
import { useNavigazione } from "./navigazione";

export function BarraTitolo() {
  const n = useNavigazione();
  return (
    <div className="barra-titolo">
      {/* il semaforo vero è del Mac (trafficLightPosition in finestra.ts); le luci si disegnano solo nella prova di parità */}
      <div className="semaforo" aria-hidden>
        <span className="luce rosso" /><span className="luce giallo" /><span className="luce verde" />
      </div>
      <div className="navigazione">
        <BottoneIcona icona="barra-laterale" etichetta="Barra laterale" onClick={n.alternaBarra} aria-pressed={n.barraAperta} />
        <BottoneIcona icona="indietro" etichetta="Indietro" onClick={n.indietro} disabled={!n.puoIndietro} />
        <BottoneIcona icona="avanti" etichetta="Avanti" onClick={n.avanti} disabled={!n.puoAvanti} />
      </div>
    </div>
  );
}
