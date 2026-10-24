// figma: 101-17893 — Impostazioni · Dati; sottopagina «Cartelle nascoste»: 101-33235.
// «Sessioni finite» aperta: 119:56891. Conferma di «Elimina dati…»: 119:57106.
import { useState } from "react";
import { avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { messaggioErrore } from "../base/dati";
import { Dialogo } from "../base/Dialogo";
import { Icona } from "../base/Icona";
import { useNavigazione } from "../base/navigazione";
import { Gruppo, Interruttore, Pagina, Riga, Scelta, VuotoLista } from "./controlli";
import { prova } from "./prova";
import { imposta, leggi, useImpostazioni } from "./stato";

const CRONOLOGIA = ["7 giorni", "30 giorni", "90 giorni", "Per sempre"];

async function escludi(escluse: string[]) {
  try {
    const p = await window.impostazioni.scegliCartella();
    if (p && !escluse.includes(p)) imposta("cartelleEscluse", [...escluse, p]);
  } catch (e) { avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }); }
}

/** Come «Rimuovi» in Account: subito, con «Annulla» nell'avviso. */
function rimuovi(p: string) {
  imposta("cartelleEscluse", leggi("cartelleEscluse").filter((x) => x !== p));
  avvisa({ tipo: "info", messaggio: "Cartella rimossa", azione: { etichetta: "Annulla", fai: () => imposta("cartelleEscluse", [...leggi("cartelleEscluse"), p]) } });
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
    <Pagina titolo="Cartelle nascoste" sopra={indietro}>
      <Gruppo>
        {v.cartelleEscluse.length === 0
          ? (
            <VuotoLista titolo="Nessuna cartella esclusa" corpo="Le sessioni di una cartella esclusa non compaiono in clotch.">
              <Bottone tipo="secondario" onClick={() => escludi(v.cartelleEscluse)}>Aggiungi cartella</Bottone>
            </VuotoLista>
          )
          : v.cartelleEscluse.map((p) => (
            <Riga key={p} etichetta={p} azione>
              <Bottone tipo="secondario" aria-label={`Rimuovi ${p}`} onClick={() => rimuovi(p)}>Rimuovi</Bottone>
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
    window.impostazioni.eliminaDati().then(() => avvisa({ tipo: "info", messaggio: "Dati eliminati" }), (e) => avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }));
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
        <Riga etichetta="Cartelle nascoste" descrizione="Le sessioni in queste cartelle non si leggono">
          <button type="button" className="valore-scelta" onClick={() => n.apri("impostazioni", undefined, "dati/cartelle")}>
            <span className="t-sm secondario">{escluse === 1 ? "1 cartella" : `${escluse} cartelle`}</span>
            <Icona nome="destra" />
          </button>
        </Riga>
        <Riga etichetta="Sessioni finite" descrizione="Per quanto tempo restano le sessioni finite">
          <Scelta etichetta="Sessioni finite" valore={v.cronologia} voci={CRONOLOGIA} onScegli={(x) => imposta("cronologia", x)} />
        </Riga>
        <Riga etichetta="Dati di clotch" descrizione="Indice e impostazioni. Le sessioni originali non si toccano." azione>
          <Bottone tipo="secondario" className="pericolo" onClick={() => setConferma(true)}>Elimina dati…</Bottone>
        </Riga>
      </Gruppo>
      {conferma && (
        <Dialogo titolo="Eliminare i dati di clotch?" corpo="Indice, cache e impostazioni vengono eliminati. Le sessioni originali non si toccano e clotch le rilegge da capo."
          onChiudi={() => setConferma(false)}
          bottoni={<>
            <Bottone tipo="secondario" onClick={() => setConferma(false)}>Annulla</Bottone>
            <Bottone tipo="pericolo" onClick={elimina}>Elimina dati</Bottone>
          </>} />
      )}
    </Pagina>
  );
}
