// figma: 101-31738 — Impostazioni · Aspetto, con «Tema» (#1093). Tendine: colore 119:55904, carattere 119:56054, dimensione 119:56211, densità 119:56375.
import { Gruppo, Interruttore, Pagina, Riga, Scelta } from "./controlli";
import { imposta, useImpostazioni } from "./stato";

const TEMI = ["Automatico", "Chiaro", "Scuro"];
const COLORI = ["Arancione", "Blu", "Verde", "Viola", "Argento"];
const CARATTERI = { Sistema: "SF Pro", Arrotondato: "SF Pro Rounded", Monospaziato: "SF Mono" };
const DIMENSIONI = { Piccola: "13 px", Media: "14 px", Grande: "16 px" };
const DENSITA = { Compatta: "28 px", Normale: "32 px", Ariosa: "40 px" };

export default function Aspetto() {
  const v = useImpostazioni();
  return (
    <Pagina titolo="Aspetto">
      <Gruppo>
        <Riga etichetta="Tema" descrizione="Chiaro, scuro o come il Mac"><Scelta etichetta="Tema" valore={v.tema} voci={TEMI} onScegli={(x) => imposta("tema", x)} /></Riga>
        <Riga etichetta="Colore principale" descrizione="Bottoni, segni di stato e messaggi tuoi"><Scelta etichetta="Colore principale" valore={v.colore} voci={COLORI} onScegli={(x) => imposta("colore", x)} /></Riga>
        <Riga etichetta="Carattere" descrizione="Testo dell’app"><Scelta etichetta="Carattere" valore={v.carattere} voci={Object.keys(CARATTERI)} dettagli={CARATTERI} onScegli={(x) => imposta("carattere", x)} /></Riga>
        <Riga etichetta="Dimensione del testo" descrizione="Vale per conversazione ed elenco"><Scelta etichetta="Dimensione del testo" valore={v.dimensione} voci={Object.keys(DIMENSIONI)} dettagli={DIMENSIONI} onScegli={(x) => imposta("dimensione", x)} /></Riga>
        <Riga etichetta="Densità dell’elenco" descrizione="Spazio tra le righe della barra laterale"><Scelta etichetta="Densità dell’elenco" valore={v.densita} voci={Object.keys(DENSITA)} dettagli={DENSITA} onScegli={(x) => imposta("densita", x)} /></Riga>
        <Riga etichetta="Pannello obiettivo" descrizione="Mostralo aperto quando apri una sessione">
          <Interruttore etichetta="Pannello obiettivo" acceso={v.pannelloAperto} onCambia={(x) => imposta("pannelloAperto", x)} />
        </Riga>
        <Riga etichetta="Icone delle sessioni" descrizione="Mostra l’icona accanto al titolo">
          <Interruttore etichetta="Icone delle sessioni" acceso={v.iconeSessioni} onCambia={(x) => imposta("iconeSessioni", x)} />
        </Riga>
      </Gruppo>
    </Pagina>
  );
}
