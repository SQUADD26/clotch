// figma: 101-7873 — «intestazione» della sessione aperta (101:8036): icona e titolo, stato · progetto · ramo · modello · sorgente,
// a destra pannello e altro. Stati dai frame 101:13650 (In attesa di te), 101:9340 (Ferma), 101:15335 (Finita), 101:15993 (Non risponde); menu del «…» 101:20859.
import { useState } from "react";
import type { PreferenzeSessione, Sessione } from "../../tipi";
import { vociMenuSessione } from "../barra/Menu";
import { BottoneIcona } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { IconaSessione } from "../base/IconaSessione";
import { Menu } from "../base/Menu";
import { useNavigazione } from "../base/navigazione";
import { SegnoStato, type StatoSegno } from "../base/SegnoStato";
import { nomeModello } from "./Casella";
import { SORGENTE, nomeAccount, provaDi } from "./testi";
import "./intestazione.css";

const STATO: Record<StatoSegno, string> = {
  lavora: "In corso", aspetta: "In attesa di te", ferma: "Ferma", finita: "Finita", errore: "Non risponde",
};

export function TestaSessione({ s, nonRisponde, pref }: { s: Sessione; nonRisponde: boolean; pref?: PreferenzeSessione }) {
  const n = useNavigazione();
  // la scena di prova «menu-sessione» parte col menu aperto (101:20859)
  const [menu, setMenu] = useState(provaDi(n.sezione, "menu-sessione") !== null);
  const stato: StatoSegno = nonRisponde ? "errore" : s.stato;
  const dati = [s.progetto, s.ramo, nomeModello(s.modello), `${SORGENTE[s.sorgente]} · ${nomeAccount(s.account)}`];
  return (
    <div className="intestazione">
      <div className="testi">
        <div className="riga-titolo">
          <IconaSessione icona={pref?.icona} colore={pref?.colore} />
          <span className="titolo">{s.titolo}</span>
        </div>
        <div className="dati">
          <span className="stato"><SegnoStato stato={stato} />{STATO[stato]}</span>
          {dati.map((d, i) => d && (
            <span key={i} className="dato">
              <span className="separatore">·</span>
              {i === 1 ? <span className="ramo"><Icona nome="ramo" /><span className="codice">{d}</span></span> : d}
            </span>
          ))}
        </div>
      </div>
      <div className="azioni">
        <BottoneIcona icona="pannello" etichetta="Pannello" aria-expanded={n.pannelloAperto && n.pannelloInfo} onClick={n.alternaPannello} />
        {/* «menu sessione» sotto il «…» (101:20859): le stesse voci della riga nella barra */}
        <div className="con-menu">
          <BottoneIcona icona="altro" etichetta="Altro" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((x) => !x)} />
          {menu && <Menu voci={vociMenuSessione(s, pref)} onChiudi={() => setMenu(false)} fine />}
        </div>
      </div>
    </div>
  );
}
