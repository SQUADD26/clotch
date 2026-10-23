// figma: 101-18054 — Impostazioni · Info.
// shortcut: la tendina «Versione» e «Novità della versione» aspettano il loro codice (frame 119:57404, 119:57552).
import { useEffect, useState } from "react";
import { avvisa } from "../base/Avvisi";
import { messaggioErrore } from "../base/dati";
import { Icona } from "../base/Icona";
import { Gruppo, Interruttore, Pagina, Riga, Scelta } from "./controlli";
import { imposta, useImpostazioni } from "./stato";

export default function Info() {
  const v = useImpostazioni();
  const [versione, setVersione] = useState("");
  useEffect(() => { window.impostazioni.versione().then(setVersione, () => {}); }, []);
  const apriRegistro = () => window.impostazioni.apri(v.cartellaRegistro).catch((e) => avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }));
  return (
    <Pagina titolo="Info">
      <Gruppo>
        <Riga etichetta="Versione" descrizione="Aggiornata">
          <Scelta etichetta="Versione" valore={versione} />
        </Riga>
        <Riga etichetta="Aggiornamenti automatici" descrizione="Si installano alla prossima apertura">
          <Interruttore etichetta="Aggiornamenti automatici" acceso={v.aggiornamentiAutomatici} onCambia={(x) => imposta("aggiornamentiAutomatici", x)} />
        </Riga>
        <Riga etichetta="Registro" descrizione="File con gli errori dell’app">
          <button type="button" className="valore-scelta" onClick={apriRegistro}>
            <span className="t-sm secondario">Apri cartella</span>
            <Icona nome="giu" />
          </button>
        </Riga>
        <Riga etichetta="Note di rilascio" azione>
          <span className="link t-sm">Novità della versione {versione}</span>
        </Riga>
      </Gruppo>
    </Pagina>
  );
}
