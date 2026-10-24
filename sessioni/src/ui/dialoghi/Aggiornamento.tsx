// figma: 101-22137 — «Dialogo: aggiornamento»: titolo, corpo e due bottoni sopra il velo della finestra.
import { useState } from "react";
import { avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { messaggioErrore } from "../base/dati";
import { Dialogo } from "../base/Dialogo";
import { chiudiDialogo } from "../base/dialoghi";

/** «Aggiorna» riapre l'app (main: `aggiornamenti("installa")`); se il main non la riapre il dialogo resta e dice perché. */
async function aggiorna(occupato: (v: boolean) => void) {
  occupato(true);
  try {
    if (await window.impostazioni.aggiornamenti("installa")) return;
    avvisa({ tipo: "errore", messaggio: "Riavvio non riuscito. Chiudi e riapri clotch." });
  } catch (e) { avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }); }
  occupato(false);
  chiudiDialogo();
}

export function DialogoAggiornamento() {
  const [inCorso, setInCorso] = useState(false);
  return (
    <Dialogo titolo="Aggiornare clotch ora?" corpo="clotch si chiude e si riapre in pochi secondi. Le sessioni continuano a lavorare." onChiudi={chiudiDialogo}
      bottoni={<><Bottone tipo="secondario" onClick={chiudiDialogo}>Più tardi</Bottone><Bottone caricamento={inCorso} onClick={() => void aggiorna(setInCorso)}>Aggiorna</Bottone></>} />
  );
}
