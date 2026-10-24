// figma: 101-17193 — Impostazioni · Generale; tendina della lingua aperta: 101-32827.
import { avvisa } from "../base/Avvisi";
import { Icona } from "../base/Icona";
import { Bottone } from "../base/Bottone";
import { messaggioErrore } from "../base/dati";
import { MODELLI } from "../chat/testi";
import { CampoTesto, Gruppo, Interruttore, Pagina, Riga, Scelta } from "./controlli";
import { imposta, IN_NUOVA_FINESTRA, useImpostazioni } from "./stato";

const DETTAGLI_MODELLI = Object.fromEntries(Object.entries(MODELLI).map(([k, m]) => [k, m.dettaglio])); // 119:55555
const APERTURE = ["Nella stessa finestra", IN_NUOVA_FINESTRA]; // 119:55726

async function cambiaCartella() {
  try {
    const nuova = await window.impostazioni.scegliCartella();
    if (nuova) imposta("cartellaRegistro", nuova);
  } catch (e) { avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }); }
}

export default function Generale() {
  const v = useImpostazioni();
  return (
    <Pagina titolo="Generale">
      <Gruppo>
        <Riga etichetta="Apri all’avvio del Mac" descrizione="clotch parte quando accendi il Mac">
          <Interruttore etichetta="Apri all’avvio del Mac" acceso={v.apriAllAvvio} onCambia={(x) => imposta("apriAllAvvio", x)} />
        </Riga>
        <Riga etichetta="Mostra nella barra dei menu" descrizione="In alto sul Mac, accanto all’orologio: l’icona di clotch e quante sessioni aspettano te" azione>
          <span className="tasto-chip" aria-hidden="true"><Icona nome="schermo" /> 2</span>
          <Interruttore etichetta="Mostra nella barra dei menu" acceso={v.barraDeiMenu} onCambia={(x) => imposta("barraDeiMenu", x)} />
        </Riga>
        <Riga etichetta="Lingua" descrizione="L’app c’è solo in italiano">
          <Scelta etichetta="Lingua" valore="Italiano" disabled />
        </Riga>
        <Riga etichetta="Modello per i tuoi messaggi" descrizione="Usato quando scrivi a una sessione da qui">
          <Scelta etichetta="Modello per i tuoi messaggi" valore={v.modello} voci={Object.keys(MODELLI)} dettagli={DETTAGLI_MODELLI} onScegli={(x) => imposta("modello", x)} />
        </Riga>
        <Riga etichetta="Apri una sessione" descrizione="Cosa succede quando ne scegli una dall’elenco">
          <Scelta etichetta="Apri una sessione" valore={v.apriSessione} voci={APERTURE} onScegli={(x) => imposta("apriSessione", x)} />
        </Riga>
        <Riga etichetta="Cartella del registro" descrizione="Dove clotch scrive gli errori" azione>
          <CampoTesto valore={v.cartellaRegistro} />
          <Bottone tipo="secondario" onClick={cambiaCartella}>Cambia</Bottone>
        </Riga>
      </Gruppo>
    </Pagina>
  );
}
