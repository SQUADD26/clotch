// figma: 101-32155 — Impostazioni · Archiviazione: spazio di indice e cache del main (#368), «Ricostruisci» e «Svuota».
import { useState } from "react";
import { avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { api, messaggioErrore, useChiamata } from "../base/dati";
import { Icona } from "../base/Icona";
import { Gruppo, Pagina, Riga } from "./controlli";

// voci della legenda nell'ordine del frame, con la chiave di `api().spazio()`
const PARTI = [
  { chiave: "indice", nome: "Indice", colore: "--colore-icona-accento" },
  { chiave: "messaggi", nome: "Cache dei messaggi", colore: "--colore-sessione-blu" },
  { chiave: "immagini", nome: "Immagini", colore: "--colore-sessione-viola" },
  { chiave: "altro", nome: "Altro", colore: "--colore-sessione-grigio" },
] as const;

const mb = (byte: number) => `${Math.round(byte / 1e6)} MB`;

export default function Archiviazione() {
  const spazio = useChiamata(() => api().spazio(), []);
  const [occupato, setOccupato] = useState(false);
  const fai = (azione: () => Promise<void>, fatto: string) => {
    setOccupato(true);
    azione().then(() => { spazio.ricarica(); avvisa({ tipo: "info", messaggio: fatto }); }, (e) => avvisa({ tipo: "errore", messaggio: messaggioErrore(e) })).finally(() => setOccupato(false));
  };
  const totale = PARTI.reduce((t, p) => t + (spazio.dati?.[p.chiave] ?? 0), 0);
  return (
    <Pagina titolo="Archiviazione">
      {spazio.dati && (
        <div className="spazio-usato">
          <div className="t-base">Usati da clotch: {mb(totale)}</div>
          <div className="barra-segmentata">
            {PARTI.map((p) => <div key={p.chiave} style={{ flex: spazio.dati![p.chiave], background: `var(${p.colore})` }} />)}
          </div>
          <div className="legenda">
            {PARTI.map((p) => (
              <span key={p.chiave} className="voce-legenda">
                <span className="campione" style={{ background: `var(${p.colore})` }} />
                <span className="t-sm secondario">{p.nome}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <Gruppo>
        <Riga etichetta="Indice delle sessioni" descrizione="Ricostruiscilo se l’elenco non torna" azione>
          <Bottone tipo="secondario" disabled={occupato} onClick={() => fai(api().ricostruisci, "Indice ricostruito")}>Ricostruisci</Bottone>
        </Riga>
        <Riga etichetta="Cache dei messaggi" descrizione="Si riempie da sola quando apri una sessione" azione>
          <Bottone tipo="secondario" disabled={occupato} onClick={() => fai(api().svuota, "Cache svuotata")}>Svuota</Bottone>
        </Riga>
        {spazio.stato === "carica" && (
          <div className="riga calcolo">
            <Icona nome="spinner" gira />
            <span className="t-sm secondario">Calcolando lo spazio delle immagini…</span>
          </div>
        )}
      </Gruppo>
    </Pagina>
  );
}
