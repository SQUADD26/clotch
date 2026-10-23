// figma: 101-17893 — Impostazioni · Dati; sottopagina «Cartelle escluse»: 101-33235.
// shortcut: la cronologia e «Elimina dati…» aspettano i frame della tendina e della conferma (119:56891, 119:57106).
import { avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { messaggioErrore } from "../base/dati";
import { Icona } from "../base/Icona";
import { useNavigazione } from "../base/navigazione";
import { Gruppo, Interruttore, Pagina, Riga, Scelta, VuotoLista } from "./controlli";
import { imposta, useImpostazioni } from "./stato";

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
            <Icona nome="giu" />
          </button>
        </Riga>
        <Riga etichetta="Cronologia" descrizione="Per quanto tempo restano le sessioni finite">
          <Scelta etichetta="Cronologia" valore={v.cronologia} />
        </Riga>
        <Riga etichetta="Dati di Sessioni" descrizione="Indice e impostazioni. Le sessioni originali non si toccano." azione>
          <Bottone tipo="secondario" className="pericolo" disabled>Elimina dati…</Bottone>
        </Riga>
      </Gruppo>
    </Pagina>
  );
}
