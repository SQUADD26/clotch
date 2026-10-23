// figma: 101-17193 — pagina Impostazioni (#351): «Navigazione impostazioni» a sinistra, la sezione scelta nella «Superficie».
import { useEffect, useState, type ComponentType } from "react";
import { AreaAvvisi } from "../base/Avvisi";
import { Superficie } from "../base/Cornice";
import { Icona } from "../base/Icona";
import { useNavigazione } from "../base/navigazione";
import { prova } from "./prova";
import { SEZIONI, type Sezione } from "./sezioni";
import { caricaImpostazioni } from "./stato";
import Account from "./account";
import Archiviate from "./archiviate";
import Archiviazione from "./archiviazione";
import Aspetto from "./aspetto";
import Clotch from "./clotch";
import Dati from "./dati";
import ClotchAi from "./clotch-ai";
import Generale from "./generale";
import Info from "./info";
import Notifiche from "./notifiche";
import Scorciatoie from "./scorciatoie";
import Sorgenti from "./sorgenti";
import Uso from "./uso";
import { Ricerca } from "./Ricerca";
import "./impostazioni.css";

const PAGINE: Record<Sezione, ComponentType<{ sotto?: string }>> = {
  generale: Generale, aspetto: Aspetto, notifiche: Notifiche, "clotch-ai": ClotchAi, scorciatoie: Scorciatoie, sorgenti: Sorgenti,
  account: Account, uso: Uso, archiviate: Archiviate, archiviazione: Archiviazione, dati: Dati, info: Info, clotch: Clotch,
};

export default function Impostazioni() {
  const n = useNavigazione();
  const [cerca, setCerca] = useState(prova?.cerca ?? "");
  useEffect(caricaImpostazioni, []);
  // prova di parità di un frame con una tendina aperta: la si apre come farebbe un clic
  useEffect(() => { if (prova?.aperta) document.querySelector<HTMLButtonElement>(`.scelta .valore[aria-label^="${prova.aperta}:"]`)?.click(); }, []);
  // la sezione sta nella navigazione (indietro e avanti la seguono); «dati/cartelle» è una sottopagina di Dati
  const [prima, sotto] = (n.sezione ?? "generale").split("/");
  const sezione: Sezione = prima in PAGINE ? (prima as Sezione) : "generale";
  const Pagina = PAGINE[sezione];
  return (
    <div className="impostazioni">
      <nav className="nav-impostazioni" aria-label="Impostazioni">
        <div className="titolo t-lg">Impostazioni</div>
        <Ricerca testo={cerca} onTesto={setCerca} sezione={sezione} />
        {!cerca.trim() && SEZIONI.map(([id, nome, icona]) => (
          <button key={id} type="button" className={`voce ${id === sezione ? "scelta" : ""}`}
            aria-current={id === sezione ? "page" : undefined} onClick={() => n.apri("impostazioni", undefined, id)}>
            <Icona nome={icona} /><span>{nome}</span>
          </button>
        ))}
      </nav>
      <Superficie>
        <div className="scorre-impostazioni"><Pagina key={n.sezione} sotto={sotto} /></div>
        <AreaAvvisi />
      </Superficie>
    </div>
  );
}
