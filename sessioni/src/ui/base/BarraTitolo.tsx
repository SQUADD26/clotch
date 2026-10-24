// figma: 101-7712 — «Barra titolo»: posto del semaforo del Mac, navigazione (barra laterale, indietro, avanti) e,
// a destra, «comandi globali» (101-37696) montati dai pezzi che esportano `ComandiTitolo`.
import type { ComponentType } from "react";
import * as clotchAi from "../clotch-ai";
import * as pannello from "../pannello";
import { Attivita } from "./Attivita";
import { useImpostazioni } from "../impostazioni/stato";
import { BottoneIcona } from "./Bottone";
import { Suggerimento } from "./Suggerimento";
import { Pezzo } from "./Pezzo";
import { TornaAClotchAi } from "./TornaAClotchAi";
import { useNavigazione } from "./navigazione";

// export facoltativo: il pezzo lo aggiunge quando ne ha bisogno, la base non tocca il suo file
const comandi = (m: object) => (m as { ComandiTitolo?: ComponentType }).ComandiTitolo;
const ComandiPannello = comandi(pannello), ComandiClotchAi = comandi(clotchAi);
const CentroPannello = (pannello as { CentroTitolo?: ComponentType }).CentroTitolo; // pillola «schermo occupato» (101-49592)

export function BarraTitolo() {
  const n = useNavigazione();
  const { scorciatoie } = useImpostazioni();
  // il suggerimento sostituisce quello nativo (title); «suggerimento-barra» nella sezione di una scena di prova lo tiene aperto (101-24069)
  const nuda = { title: undefined };
  return (
    <div className="barra-titolo">
      {/* il semaforo vero è del Mac (trafficLightPosition in finestra.ts); le luci si disegnano solo nella prova di parità */}
      <div className="semaforo" aria-hidden>
        <span className="luce rosso" /><span className="luce giallo" /><span className="luce verde" />
      </div>
      <div className="navigazione">
        {/* nelle impostazioni la navigazione ha solo indietro e avanti (101-17193) */}
        {n.vista !== "impostazioni" && (
          <Suggerimento testo={n.barraAperta ? "Nascondi barra laterale" : "Mostra barra laterale"} scorciatoia={scorciatoie.barra} forzato={n.sezione === "suggerimento-barra"}>
            <BottoneIcona icona="barra-laterale" etichetta="Barra laterale" onClick={n.alternaBarra} aria-pressed={n.barraAperta} {...nuda} />
          </Suggerimento>
        )}
        <Suggerimento testo="Indietro"><BottoneIcona icona="indietro" etichetta="Indietro" onClick={n.indietro} disabled={!n.puoIndietro} {...nuda} /></Suggerimento>
        <Suggerimento testo="Avanti"><BottoneIcona icona="avanti" etichetta="Avanti" onClick={n.avanti} disabled={!n.puoAvanti} {...nuda} /></Suggerimento>
      </div>
      <TornaAClotchAi />
      {/* le impostazioni non hanno attività né comandi globali (101-17193) */}
      {n.vista !== "impostazioni" && (
        <>
          {/* 101-30172: subito dopo la navigazione, distanza = gap della barra */}
          <Attivita />
          {CentroPannello && <Pezzo nome="pannello"><CentroPannello /></Pezzo>}
          <div className="comandi-globali">
            {ComandiPannello && <Pezzo nome="pannello"><ComandiPannello /></Pezzo>}
            {ComandiClotchAi && <Pezzo nome="clotch-ai"><ComandiClotchAi /></Pezzo>}
          </div>
        </>
      )}
    </div>
  );
}
