// figma: 101-7712 — «Barra titolo»: posto del semaforo del Mac, navigazione (barra laterale, indietro, avanti) e,
// a destra, «comandi globali» (101-37696) montati dai pezzi che esportano `ComandiTitolo`.
import type { ComponentType } from "react";
import * as friday from "../friday";
import * as pannello from "../pannello";
import { Attivita } from "./Attivita";
import { BottoneIcona } from "./Bottone";
import { Pezzo } from "./Pezzo";
import { useNavigazione } from "./navigazione";

// export facoltativo: il pezzo lo aggiunge quando ne ha bisogno, la base non tocca il suo file
const comandi = (m: object) => (m as { ComandiTitolo?: ComponentType }).ComandiTitolo;
const ComandiPannello = comandi(pannello), ComandiFriday = comandi(friday);
const CentroPannello = (pannello as { CentroTitolo?: ComponentType }).CentroTitolo; // pillola «schermo occupato» (101-49592)

export function BarraTitolo() {
  const n = useNavigazione();
  return (
    <div className="barra-titolo">
      {/* il semaforo vero è del Mac (trafficLightPosition in finestra.ts); le luci si disegnano solo nella prova di parità */}
      <div className="semaforo" aria-hidden>
        <span className="luce rosso" /><span className="luce giallo" /><span className="luce verde" />
      </div>
      <div className="navigazione">
        {/* nelle impostazioni la navigazione ha solo indietro e avanti (101-17193) */}
        {n.vista !== "impostazioni" && <BottoneIcona icona="barra-laterale" etichetta="Barra laterale" onClick={n.alternaBarra} aria-pressed={n.barraAperta} />}
        <BottoneIcona icona="indietro" etichetta="Indietro" onClick={n.indietro} disabled={!n.puoIndietro} />
        <BottoneIcona icona="avanti" etichetta="Avanti" onClick={n.avanti} disabled={!n.puoAvanti} />
      </div>
      {/* le impostazioni non hanno attività né comandi globali (101-17193) */}
      {n.vista !== "impostazioni" && (
        <>
          {/* 101-30172: subito dopo la navigazione, distanza = gap della barra */}
          <Attivita />
          {CentroPannello && <Pezzo nome="pannello"><CentroPannello /></Pezzo>}
          <div className="comandi-globali">
            {ComandiPannello && <Pezzo nome="pannello"><ComandiPannello /></Pezzo>}
            {ComandiFriday && <Pezzo nome="friday"><ComandiFriday /></Pezzo>}
          </div>
        </>
      )}
    </div>
  );
}
