// figma: 101-7873 — «intestazione» della sessione aperta (101:8036): icona e titolo, stato · progetto · ramo · modello · sorgente,
// a destra pannello e altro. Stati dai frame 101:13650 (In attesa di te), 101:9340 (Ferma), 101:15335 (Finita), 101:15993 (Non risponde).
import type { Sessione } from "../../tipi";
import { BottoneIcona } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { IconaSessione } from "../base/IconaSessione";
import { useNavigazione } from "../base/navigazione";
import { SegnoStato, type StatoSegno } from "../base/SegnoStato";
import { nomeModello } from "./Casella";
import { SORGENTE, nomeAccount } from "./testi";
import "./intestazione.css";

const STATO: Record<StatoSegno, string> = {
  lavora: "In corso", aspetta: "In attesa di te", ferma: "Ferma", finita: "Finita", errore: "Non risponde",
};

export function TestaSessione({ s, nonRisponde, icona, colore }: { s: Sessione; nonRisponde: boolean; icona?: string; colore?: string }) {
  const n = useNavigazione();
  const stato: StatoSegno = nonRisponde ? "errore" : s.stato;
  const dati = [s.progetto, s.ramo, nomeModello(s.modello), `${SORGENTE[s.sorgente]} · ${nomeAccount(s.account)}`];
  return (
    <div className="intestazione">
      <div className="testi">
        <div className="riga-titolo">
          <IconaSessione icona={icona} colore={colore} />
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
        <BottoneIcona icona="pannello" etichetta="Pannello" onClick={n.alternaPannello} />
        {/* shortcut: il menu della sessione è della barra (issue 348); il bottone resta senza menu finché la barra non esporta le voci */}
        <BottoneIcona icona="altro" etichetta="Altro" />
      </div>
    </div>
  );
}
