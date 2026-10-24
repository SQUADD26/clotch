// figma: 101-18054 — Impostazioni · Info; tendina «Versione»: 119-57404; dialogo «Novità della versione»: 119-57552.
import { useEffect, useState } from "react";
import { avvisa } from "../base/Avvisi";
import { messaggioErrore, useChiamata } from "../base/dati";
import { apriDialogo, apriNovita, verificaAggiornamenti } from "../base/dialoghi";
import { Bottone } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { Menu, type VoceMenu } from "../base/Menu";
import type { Novita } from "../../tipi";
import { Gruppo, Interruttore, Pagina, Riga } from "./controlli";
import { prova } from "./prova";
import { imposta, useImpostazioni } from "./stato";

/** «Versione»: un valore con la freccia che apre un menu di azioni (non una scelta: nessuna spunta). */
function TendinaVersione({ versione, voci }: { versione: string; voci: VoceMenu[] }) {
  const [aperta, setAperta] = useState(false);
  return (
    <div className="scelta">
      <button type="button" className="valore" aria-label={`Versione: ${versione}`} aria-haspopup="menu" aria-expanded={aperta}
        onClick={() => setAperta((x) => !x)}>
        <span className="t-sm secondario">{versione}</span>
        <Icona nome="giu" />
      </button>
      {aperta && <Menu onChiudi={() => setAperta(false)} fine classe="menu-scelta" voci={voci} />}
    </div>
  );
}

export default function Info() {
  const v = useImpostazioni();
  const letta = useChiamata(() => window.impostazioni.versione(), []);
  const versione = letta.dati ?? "";
  // c'è sul disco una versione più nuova di quella aperta? (lo stesso controllo di «Controlla aggiornamenti», senza dialogo)
  const nuova = useChiamata(() => window.impostazioni.aggiornamenti(true), []);
  const [novita, setNovita] = useState<Novita | null>(null);
  useEffect(() => { window.impostazioni.novita().then(setNovita, () => {}); }, []); // senza note la riga «Novità» non c'è: nessun errore da dire
  useEffect(() => { if (prova?.novita && novita && versione) apriDialogo("novita", { versione, novita }); }, [novita, versione]);
  const errore = (e: unknown) => avvisa({ tipo: "errore", messaggio: messaggioErrore(e) });
  const apriRegistro = () => window.impostazioni.apri(v.cartellaRegistro).catch(errore);
  const voci: VoceMenu[] = [
    { etichetta: "Controlla aggiornamenti", fai: () => { nuova.ricarica(); void verificaAggiornamenti(); } },
    ...(novita ? [{ etichetta: `Novità`, fai: () => void apriNovita() }] : []),
    { etichetta: "Copia versione", fai: () => { navigator.clipboard.writeText(versione).then(() => avvisa({ tipo: "info", messaggio: "Versione copiata" }), errore); } },
  ];
  return (
    <Pagina titolo="Info">
      <Gruppo>
        <Riga etichetta="Versione" errore={letta.stato === "errore" || nuova.stato === "errore"}
          descrizione={letta.stato === "errore" ? `Versione non letta: ${letta.errore}` : nuova.stato === "carica" ? "Controllo degli aggiornamenti…" : nuova.stato === "errore" ? "Controllo degli aggiornamenti non riuscito" : nuova.dati ? "Nuova versione pronta: riapri clotch" : "Aggiornata"}>
          {letta.stato === "errore" ? <Bottone tipo="secondario" onClick={letta.riprova}>Riprova</Bottone> : <TendinaVersione versione={versione || "…"} voci={voci} />}
        </Riga>
        <Riga etichetta="Aggiornamenti automatici" descrizione="Non disponibili: non c’è un server di aggiornamenti">
          <Interruttore etichetta="Aggiornamenti automatici" acceso={false} disabled onCambia={() => {}} />
        </Riga>
        <Riga etichetta="Registro" descrizione="File con gli errori dell’app">
          <button type="button" className="valore-scelta" onClick={apriRegistro}>
            <span className="t-sm secondario">Apri cartella</span>
            <Icona nome="giu" />
          </button>
        </Riga>
        {novita && (
          <Riga etichetta="Novità" azione>
            <button type="button" className="valore-scelta" onClick={() => void apriNovita()}>
              <span className="t-sm secondario">Versione {versione}</span>
              <Icona nome="destra" />
            </button>
          </Riga>
        )}
      </Gruppo>
    </Pagina>
  );
}
