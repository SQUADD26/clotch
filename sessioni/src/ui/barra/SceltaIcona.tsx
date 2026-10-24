// figma: 101-12169 — «Scelta icona»: cerca, sei colori «colore/sessione/…», 24 icone, «Rimuovi icona».
import { useState } from "react";
import type { PreferenzeSessione } from "../../tipi";
import { Bottone } from "../base/Bottone";
import { Icona, type NomeIcona } from "../base/Icona";
import { COLORI_SESSIONE as COLORI, IconaSessione } from "../base/IconaSessione";
import { Sovrapposto, type Ancora } from "../base/Sovrapposto";
import "./scelta-icona.css";

const ICONE: NomeIcona[] = [
  "stella", "database", "tavolozza", "codice", "razzo", "insetto", "libro", "grafico", "calendario", "telefono", "posta", "globo",
  "lampadina", "fulmine", "cuore", "bandiera", "casa", "chiave", "scudo", "strati", "scintille", "pacco", "valigetta", "bussola",
];

type Parte = { [K in keyof PreferenzeSessione]?: PreferenzeSessione[K] | null };

export function SceltaIcona({ a, pref, onImposta, onChiudi }: { a: Ancora; pref?: PreferenzeSessione; onImposta(p: Parte): void; onChiudi(): void }) {
  const [q, setQ] = useState("");
  const colore = pref?.colore ?? "grigio";
  return (
    <Sovrapposto ancora={a} className="scelta-icona" onChiudi={onChiudi}>
      <label className="cerca-icone">
        <Icona nome="cerca" />
        <input placeholder="Cerca icone" value={q} autoFocus onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="t-xs secondario">Colore</div>
      <div className="campioni" role="radiogroup" aria-label="Colore">
        {COLORI.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={c === colore} aria-label={c}
            className={`campione ${c === colore ? "scelto" : ""}`} style={{ color: `var(--colore-sessione-${c})` }}
            onClick={() => onImposta({ colore: c })}>
            {c === colore && <span className="punto" />}
          </button>
        ))}
      </div>
      <div className="t-xs secondario">Icona</div>
      <div className="griglia" role="radiogroup" aria-label="Icona">
        {ICONE.filter((n) => n.includes(q.trim().toLowerCase())).map((n) => (
          <button key={n} type="button" role="radio" aria-checked={n === pref?.icona} aria-label={n}
            className={`cella-icona ${n === pref?.icona ? "scelta" : ""}`} onClick={() => onImposta({ icona: n })}>
            <IconaSessione icona={n} colore={colore} />
          </button>
        ))}
      </div>
      <Bottone tipo="secondario" className="rimuovi" onClick={() => onImposta({ icona: null, colore: null })}>Rimuovi icona</Bottone>
    </Sovrapposto>
  );
}
