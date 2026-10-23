// figma: 101-17893 — Impostazioni · Dati; sottopagina «Cartelle escluse»: 101-33235.
// Cronologia aperta: 119:56891. Conferma di «Elimina dati…»: 119:57106.
import { useState } from "react";
import { avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { messaggioErrore } from "../base/dati";
import { Dialogo } from "../base/Dialogo";
import { Icona } from "../base/Icona";
import { useNavigazione } from "../base/navigazione";
import { Gruppo, Interruttore, Pagina, Riga, Scelta, VuotoLista } from "./controlli";
import { prova } from "./prova";
import { imposta, useImpostazioni } from "./stato";

const CRONOLOGIA = ["7 giorni", "30 giorni", "90 giorni", "Per sempre"];

async function escludi(escluse: string[]) {
  try {
    const p = await window.impostazioni.scegliCartella();
    if (p && !escluse.includes(p)) imposta("cartelleEscluse", [...escluse, p]);
  } catch (e) { avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }); }
}

function CartelleEscluse() {
  const n = useNavigazione();
  const v = useImpostazioni();
  const indietro = (
    <button type="button" className="indietro t-sm secondario" onClick={() => n.apri("impostazioni", undefined, "dati")}>
      <Icona nome="indietro" />Dati
    </button>
  );
  return (
    <Pagina titolo="Cartelle escluse" sopra={indietro}>
      <Gruppo>
        {v.cartelleEscluse.length === 0
          ? (
            <VuotoLista titolo="Nessuna cartella esclusa" corpo="Le sessioni di una cartella esclusa non compaiono in Sessioni.">
              <Bottone tipo="secondario" onClick={() => escludi(v.cartelleEscluse)}>Aggiungi cartella</Bottone>
            </VuotoLista>
          )
          : v.cartelleEscluse.map((p) => (
            <Riga key={p} etichetta={p} azione>
              <Bottone tipo="secondario" onClick={() => imposta("cartelleEscluse", v.cartelleEscluse.filter((x) => x !== p))}>Rimuovi</Bottone>
            </Riga>
          ))}
      </Gruppo>
      {v.cartelleEscluse.length > 0 && <Bottone tipo="secondario" onClick={() => escludi(v.cartelleEscluse)}>Aggiungi cartella</Bottone>}
    </Pagina>
  );
}

export default function Dati({ sotto }: { sotto?: string }) {
  const n = useNavigazione();
  const v = useImpostazioni();
  const [conferma, setConferma] = useState(!!prova?.conferma);
  const elimina = () => {
    setConferma(false);
    window.impostazioni.eliminaDati().catch((e) => avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }));
  };
  if (sotto === "cartelle") return <CartelleEscluse />;
  const escluse = v.cartelleEscluse.length;
  return (
    <Pagina titolo="Dati">
      <Gruppo>
        <Riga etichetta="Mostra i comandi interi" descrizione="Altrimenti solo il nome del comando">
          <Interruttore etichetta="Mostra i comandi interi" acceso={v.comandiInteri} onCambia={(x) => imposta("comandiInteri", x)} />
        </Riga>
        <Riga etichetta="Nascondi chiavi e token" descrizione="Li copre con •••• nei messaggi e nei comandi">
          <Interruttore etichetta="Nascondi chiavi e token" acceso={v.nascondiChiavi} onCambia={(x) => imposta("nascondiChiavi", x)} />
        </Riga>
        <Riga etichetta="Cartelle escluse" descrizione="Le sessioni in queste cartelle non si leggono">
          <button type="button" className="valore-scelta" onClick={() => n.apri("impostazioni", undefined, "dati/cartelle")}>
            <span className="t-sm secondario">{escluse === 1 ? "1 cartella" : `${escluse} cartelle`}</span>
            <Icona nome="destra" />
          </button>
        </Riga>
        <Riga etichetta="Cronologia" descrizione="Per quanto tempo restano le sessioni finite">
          <Scelta etichetta="Cronologia" valore={v.cronologia} voci={CRONOLOGIA} onScegli={(x) => imposta("cronologia", x)} />
        </Riga>
        <Riga etichetta="Dati di Sessioni" descrizione="Indice e impostazioni. Le sessioni originali non si toccano." azione>
          <Bottone tipo="secondario" className="pericolo" onClick={() => setConferma(true)}>Elimina dati…</Bottone>
        </Riga>
      </Gruppo>
      {conferma && (
        <Dialogo titolo="Eliminare i dati di Sessioni?" corpo="Cancello indice, cache e impostazioni. Le sessioni originali non si toccano e Sessioni le rilegge da capo."
          onChiudi={() => setConferma(false)}
          bottoni={<>
            <Bottone tipo="secondario" onClick={() => setConferma(false)}>Annulla</Bottone>
            <Bottone tipo="pericolo" onClick={elimina}>Elimina dati</Bottone>
          </>} />
      )}
    </Pagina>
  );
}
