// figma: 101-30345 — «Avvio»: la finestra è già aperta, la barra del titolo c'è, al centro il logo finché si legge l'elenco.
import { useEffect, useState } from "react";
import { primoElenco } from "./dati";
import { Icona } from "./Icona";
import "./avvio.css";

// ?parita=101-30345: il frame mostra l'avvio fermo, non lo lascia finire
const PROVA = new URLSearchParams(location.search).get("parita") === "101-30345";

/** Vero dall'apertura fino alla prima lettura dell'elenco (riuscita o no); il corpo sta già montato sotto, non aspetta. */
export function useAvvio() {
  const [avvio, setAvvio] = useState(true);
  useEffect(() => {
    const fine = () => setAvvio(PROVA);
    primoElenco().then(fine, fine);
  }, []);
  return avvio;
}

export function Avvio() {
  return (
    <div className="avvio" role="status" aria-label="Apertura in corso">
      <div className="logo"><Icona nome="strati" colore="su-accento" /></div>
    </div>
  );
}
