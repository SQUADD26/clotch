// figma: 101-35494 — montaggio di Friday (#352): `Intestazione`, la vista (chat Friday, Casella, Decisioni, Regole) e
// `ComandiTitolo` nella barra del titolo. Nelle scene di prova `sezione` porta lo stato da disegnare (avvisi, dialoghi, avvio).
import { useEffect } from "react";
import { useNavigazione } from "../base/navigazione";
import { Casella } from "./Casella";
import { ChatFriday } from "./ChatFriday";
import { avvisoInCorso, esitoFermo, fermo, menuQuiete } from "./ComandiTitolo";
import { avviaScena, fineAvvio, useRegistro } from "./dati";
import { Decisioni, esitoAnnulla } from "./Decisioni";
import { avvisoSalvataggio, esitoSalvataggio, Regole } from "./Regole";
import { sessioniAlLavoro, statoFriday } from "./vista";
import "./friday.css";

export { ComandiTitolo } from "./ComandiTitolo";
export { Intestazione } from "./Intestazione";

const niente = () => {};

/** Stato di una scena di prova (`sezione` = «stato» o «stato:argomento»), disegnato coi pezzi veri dell'app. */
function useScena(sezione: string | null, quante: number | null) {
  useEffect(() => {
    if (!sezione || quante === null) return;
    const [stato, arg = ""] = sezione.split(/:(.*)/s);
    const fermi = (non: string[] | null) => esitoFermo(avvisoInCorso(quante), quante, non, arg);
    ({
      "ferma-conferma": () => fermo.metti("conferma"),
      "ferma-in-corso": () => { fermo.metti("in-corso"); avvisoInCorso(quante); },
      "ferma-fatto": () => fermi([]),
      "ferma-errore": () => fermi(arg ? arg.split(",") : null),
      "quiete-menu": () => menuQuiete.metti(true),
      "annullata": () => esitoAnnulla({ esito: "ok", testo: arg }, niente),
      "annullo-errore": () => esitoAnnulla({ esito: "errore", testo: arg }, niente),
      "salvataggio": () => avvisoSalvataggio(arg),
      "salvata": () => esitoSalvataggio(avvisoSalvataggio("claude-config"), { esito: "ok", testo: "", pr: Number(arg) || undefined }, niente),
      "salvataggio-errore": () => esitoSalvataggio(avvisoSalvataggio("claude-config"), { esito: "errore", testo: arg }, niente),
      "avvio": () => avviaScena("avvio"),
      "riavvio": () => avviaScena("riavvio"),
    } as Record<string, () => unknown>)[stato]?.();
  }, [sezione, quante === null]); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function Friday() {
  const n = useNavigazione();
  const { dati: r } = useRegistro();
  useScena(n.sezione, r ? sessioniAlLavoro(r) : null);
  // «Avvio…» e «Riavvio…» finiscono quando il registro mostra Friday viva
  useEffect(() => { if (r && statoFriday(r, Date.now()).stato !== "spenta") fineAvvio(); }, [r]);
  if (n.vista === "casella") return <Casella />;
  if (n.vista === "decisioni") return <Decisioni />;
  if (n.vista === "regole") return <Regole />;
  return <ChatFriday />;
}

