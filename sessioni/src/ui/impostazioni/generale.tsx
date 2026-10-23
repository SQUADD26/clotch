// figma: 101-17193 — Impostazioni · Generale; tendina della lingua aperta: 101-32827.
import { avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { messaggioErrore } from "../base/dati";
import { CampoTesto, Gruppo, Interruttore, Pagina, Riga, Scelta } from "./controlli";
import { imposta, useImpostazioni } from "./stato";

const LINGUE = ["Rilevamento automatico", "Italiano", "English"]; // voci della «tendina lingua» 101:32999

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
        <Riga etichetta="Apri all’avvio del Mac" descrizione="Sessioni parte quando accendi il Mac">
          <Interruttore etichetta="Apri all’avvio del Mac" acceso={v.apriAllAvvio} onCambia={(x) => imposta("apriAllAvvio", x)} />
        </Riga>
        <Riga etichetta="Mostra nella barra dei menu" descrizione="Un’icona con il numero di sessioni in attesa di te">
          <Interruttore etichetta="Mostra nella barra dei menu" acceso={v.barraDeiMenu} onCambia={(x) => imposta("barraDeiMenu", x)} />
        </Riga>
        <Riga etichetta="Lingua" descrizione="Testi dell’app">
          <Scelta etichetta="Lingua" valore={v.lingua} voci={LINGUE} onScegli={(x) => imposta("lingua", x)} />
        </Riga>
        <Riga etichetta="Modello per i tuoi messaggi" descrizione="Usato quando scrivi a una sessione da qui">
          <Scelta etichetta="Modello per i tuoi messaggi" valore={v.modello} />
        </Riga>
        <Riga etichetta="Apri una sessione" descrizione="Cosa succede quando ne scegli una dall’elenco">
          <Scelta etichetta="Apri una sessione" valore={v.apriSessione} />
        </Riga>
        <Riga etichetta="Cartella del registro" descrizione="Dove Sessioni scrive gli errori" azione>
          <CampoTesto valore={v.cartellaRegistro} />
          <Bottone tipo="secondario" onClick={cambiaCartella}>Cambia</Bottone>
        </Riga>
      </Gruppo>
    </Pagina>
  );
}
