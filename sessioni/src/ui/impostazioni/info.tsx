// figma: 101-18054 — Impostazioni · Info; tendina «Versione»: 119-57404; dialogo «Novità della versione»: 119-57552.
import { useEffect, useState } from "react";
import { avvisa } from "../base/Avvisi";
import { messaggioErrore } from "../base/dati";
import { apriDialogo, apriNovita, verificaAggiornamenti } from "../base/dialoghi";
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
      {aperta && <Menu onChiudi={() => setAperta(false)} style={{ right: 0, top: "calc(100% + var(--spazio-1-5))" }} voci={voci} />}
    </div>
  );
}

export default function Info() {
  const v = useImpostazioni();
  const [versione, setVersione] = useState("");
  const [novita, setNovita] = useState<Novita | null>(null);
  useEffect(() => {
    window.impostazioni.versione().then(setVersione, () => {});
    window.impostazioni.novita().then(setNovita, () => {});
  }, []);
  useEffect(() => { if (prova?.novita && novita && versione) apriDialogo("novita", { versione, novita }); }, [novita, versione]);
  const errore = (e: unknown) => avvisa({ tipo: "errore", messaggio: messaggioErrore(e) });
  const apriRegistro = () => window.impostazioni.apri(v.cartellaRegistro).catch(errore);
  const voci: VoceMenu[] = [
    { etichetta: "Controlla aggiornamenti", fai: () => void verificaAggiornamenti() },
    ...(novita ? [{ etichetta: `Novità della versione ${versione}`, fai: () => void apriNovita() }] : []),
    { etichetta: "Copia versione", fai: () => { navigator.clipboard.writeText(versione).catch(errore); } },
  ];
  return (
    <Pagina titolo="Info">
      <Gruppo>
        <Riga etichetta="Versione" descrizione="Aggiornata">
          <TendinaVersione versione={versione} voci={voci} />
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
          <Riga etichetta="Note di rilascio" azione>
            <button type="button" className="valore-scelta" onClick={() => void apriNovita()}>
              <span className="t-sm secondario">Novità della versione {versione}</span>
              <Icona nome="destra" />
            </button>
          </Riga>
        )}
      </Gruppo>
    </Pagina>
  );
}
