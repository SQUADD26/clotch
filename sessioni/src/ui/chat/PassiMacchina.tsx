// figma: 149-67632 — «Passo preparazione» 149:67422 (Connessione … GitHub: In attesa, In corso, spunta, Non riuscito, Da fare nel Terminale); passo fallito 149:67664;
// comando da copiare 149:67696; collega GitHub col codice 149:70649.
import { useState } from "react";
import { Bottone } from "../base/Bottone";
import { avvisa } from "../base/Avvisi";
import { Icona, type NomeIcona } from "../base/Icona";
import { titoloECorpo, type RigaPasso, type StatoPasso } from "./macchine";
import "./macchine.css";

const SEGNO: Record<StatoPasso, [NomeIcona, "successo" | "accento" | "errore" | "terziaria"]> = {
  ok: ["spunta", "successo"], corso: ["in-corso", "accento"], no: ["avviso", "errore"], attesa: ["orologio", "terziaria"],
};

/** Un passo fermo che chiede una mano di Roberto (un comando per il Terminale del Mac): giallo, non rosso. */
export const chiedeMano = (r: RigaPasso) => r.stato === "no" && !!r.comando;

export function Passi({ righe }: { righe: RigaPasso[] }) {
  return (
    <div className="passi-macchina">
      {righe.map((r) => {
        const mano = chiedeMano(r);
        const [icona, colore] = mano ? (["avviso", "lavoro"] as const) : SEGNO[r.stato];
        return (
          <div key={r.passo} className={`passo ${r.stato}${mano ? " mano" : ""}`}>
            <Icona nome={icona} colore={colore} gira={r.stato === "corso"} />
            <span className="nome-passo">{r.etichetta}</span>
            <span className="dettaglio-passo">{r.dettaglio}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Il perché di un passo fallito, come lo scrive il motore: la prima frase è il titolo. */
export function AvvisoPasso({ testo }: { testo: string }) {
  const { titolo, corpo } = titoloECorpo(testo);
  return (
    <div className="avviso-avvio avviso-passo" role="alert">
      <Icona nome="avviso" colore="errore" />
      <div className="testi"><span className="titolo">{titolo}</span>{corpo && <span className="corpo">{corpo}</span>}</div>
    </div>
  );
}

const copia = (t: string) => navigator.clipboard.writeText(t);

/** «Accedi a Claude dal Terminale del Mac»: il comando esatto del motore, da copiare; mai un segreto. */
export function BloccoComando({ riga }: { riga: RigaPasso }) {
  const [copiato, setCopiato] = useState(false);
  return (
    <div className="comando-passo">
      <span className="titolo-comando">Accedi a {riga.passo === "login" ? "Claude" : riga.etichetta} dal Terminale del Mac</span>
      <span className="testo-comando">Incolla il comando nel Terminale, accedi, poi torna qui.</span>
      <div className="riga-comando">
        <code className="codice-macchina">{riga.comando}</code>
        <Bottone tipo="secondario" onClick={() => void copia(riga.comando ?? "").then(() => { setCopiato(true); setTimeout(() => setCopiato(false), 1500); }, () => avvisa({ tipo: "errore", messaggio: "Comando non copiato" }))}>{copiato ? "Copiato" : "Copia"}</Bottone>
      </div>
    </div>
  );
}

/** Accesso a GitHub col codice di verifica: il bottone copia il codice e apre `url` nel browser (il main lascia passare solo https). */
export function BloccoCodice({ riga }: { riga: RigaPasso }) {
  const apri = () => { void copia(riga.codice ?? "").then(() => avvisa({ tipo: "successo", messaggio: "Codice copiato" }), () => {}); if (riga.url) window.open(riga.url, "_blank", "noopener"); };
  return (
    <div className="codice-github">
      <div className="codice-grande" aria-label="Codice di GitHub">{riga.codice}</div>
      <Bottone tipo="primario" onClick={apri}>Copia il codice e apri GitHub</Bottone>
      <span className="nota-codice">Incolla il codice nella pagina che si apre. Attesa massima: 10 minuti.</span>
    </div>
  );
}
