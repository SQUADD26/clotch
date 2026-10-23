// figma: 101-31738 — Impostazioni · Aspetto. Solo tema scuro: le opzioni delle tendine non sono ancora disegnate (BLOCCATO in #351).
import { Gruppo, Interruttore, Pagina, Riga, Scelta } from "./controlli";
import { imposta, useImpostazioni } from "./stato";

export default function Aspetto() {
  const v = useImpostazioni();
  return (
    <Pagina titolo="Aspetto">
      <Gruppo>
        <Riga etichetta="Colore principale" descrizione="Bottoni, segni di stato e messaggi tuoi"><Scelta etichetta="Colore principale" valore={v.colore} /></Riga>
        <Riga etichetta="Carattere" descrizione="Testo dell’app"><Scelta etichetta="Carattere" valore={v.carattere} /></Riga>
        <Riga etichetta="Dimensione del testo" descrizione="Vale per conversazione ed elenco"><Scelta etichetta="Dimensione del testo" valore={v.dimensione} /></Riga>
        <Riga etichetta="Densità dell’elenco" descrizione="Spazio tra le righe della barra laterale"><Scelta etichetta="Densità dell’elenco" valore={v.densita} /></Riga>
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
