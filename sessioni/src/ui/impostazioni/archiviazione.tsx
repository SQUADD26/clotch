// figma: 101-32155 — Impostazioni · Archiviazione, con il calcolo delle immagini in corso.
// shortcut: Sessioni non ha né indice né cache (legge i file delle sessioni): niente numeri da mostrare fuori dalla prova
// (BLOCCATO in #351, fonte da creare nel main).
import { Bottone } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { Gruppo, Pagina, Riga } from "./controlli";
import { inParita } from "./prova";

// spazio usato del frame (128 MB) e colori dei segmenti, nell'ordine della legenda
const PARTI = [
  { nome: "Indice", colore: "--colore-icona-accento", peso: 300 },
  { nome: "Cache dei messaggi", colore: "--colore-sessione-blu", peso: 180 },
  { nome: "Immagini", colore: "--colore-sessione-viola", peso: 110 },
  { nome: "Altro", colore: "--colore-sessione-grigio", peso: 50 },
];

export default function Archiviazione() {
  return (
    <Pagina titolo="Archiviazione">
      {inParita && (
        <div className="spazio-usato">
          <div className="t-base">Usati da Sessioni: 128 MB</div>
          <div className="barra-segmentata">
            {PARTI.map((p) => <div key={p.nome} style={{ flex: p.peso, background: `var(${p.colore})` }} />)}
          </div>
          <div className="legenda">
            {PARTI.map((p) => (
              <span key={p.nome} className="voce-legenda">
                <span className="campione" style={{ background: `var(${p.colore})` }} />
                <span className="t-sm secondario">{p.nome}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <Gruppo>
        <Riga etichetta="Indice delle sessioni" descrizione="Ricostruiscilo se l’elenco non torna" azione>
          <Bottone tipo="secondario" disabled>Ricostruisci</Bottone>
        </Riga>
        <Riga etichetta="Cache dei messaggi" descrizione="Si riempie da sola quando apri una sessione" azione>
          <Bottone tipo="secondario" disabled>Svuota</Bottone>
        </Riga>
        {inParita && (
          <div className="riga calcolo">
            <Icona nome="spinner" gira />
            <span className="t-sm secondario">Calcolo lo spazio delle immagini…</span>
          </div>
        )}
      </Gruppo>
    </Pagina>
  );
}
