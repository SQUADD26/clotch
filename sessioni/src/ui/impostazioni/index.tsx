// figma: 101-17193 — pagina Impostazioni (#351): «Navigazione impostazioni» a sinistra, la sezione scelta nella «Superficie».
import { useEffect, useState, type ComponentType } from "react";
import { AreaAvvisi } from "../base/Avvisi";
import { Superficie } from "../base/Cornice";
import { Icona } from "../base/Icona";
import { prova } from "./prova";
import { SEZIONI, type Sezione } from "./sezioni";
import { caricaImpostazioni } from "./stato";
import Account from "./account";
import Archiviate from "./archiviate";
import Archiviazione from "./archiviazione";
import Aspetto from "./aspetto";
import Clotch from "./clotch";
import Dati from "./dati";
import Friday from "./friday";
import Generale from "./generale";
import Info from "./info";
import Notifiche from "./notifiche";
import Scorciatoie from "./scorciatoie";
import Sorgenti from "./sorgenti";
import Uso from "./uso";
import "./impostazioni.css";

const PAGINE: Record<Sezione, ComponentType> = {
  generale: Generale, aspetto: Aspetto, notifiche: Notifiche, friday: Friday, scorciatoie: Scorciatoie, sorgenti: Sorgenti,
  account: Account, uso: Uso, archiviate: Archiviate, archiviazione: Archiviazione, dati: Dati, info: Info, clotch: Clotch,
};

export default function Impostazioni() {
  const [sezione, setSezione] = useState<Sezione>(prova?.sezione ?? "generale");
  useEffect(() => caricaImpostazioni(!!prova), []);
  const Pagina = PAGINE[sezione];
  return (
    <div className="impostazioni">
      <nav className="nav-impostazioni" aria-label="Impostazioni">
        <div className="titolo t-lg">Impostazioni</div>
        {/* shortcut: i risultati della ricerca non sono disegnati (BLOCCATO in #351): la voce c'è ma non apre niente */}
        <button type="button" className="voce" disabled><Icona nome="cerca" /><span>Cerca</span></button>
        {SEZIONI.map(([id, nome, icona]) => (
          <button key={id} type="button" className={`voce ${id === sezione ? "scelta" : ""}`}
            aria-current={id === sezione ? "page" : undefined} onClick={() => setSezione(id)}>
            <Icona nome={icona} /><span>{nome}</span>
          </button>
        ))}
      </nav>
      <Superficie>
        <div className="scorre-impostazioni"><Pagina key={sezione} /></div>
        <AreaAvvisi />
      </Superficie>
    </div>
  );
}
