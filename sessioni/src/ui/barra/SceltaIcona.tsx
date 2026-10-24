// figma: 101-12169 — «Scelta icona»: cerca, sei colori «colore/sessione/…», 24 icone, «Rimuovi icona».
import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import type { PreferenzeSessione } from "../../tipi";
import { Bottone, BottoneIcona } from "../base/Bottone";
import { Icona, type NomeIcona } from "../base/Icona";
import { COLORI_SESSIONE as COLORI, IconaSessione } from "../base/IconaSessione";
import { Sovrapposto, type Ancora } from "../base/Sovrapposto";
import "./scelta-icona.css";

const ICONE: NomeIcona[] = [
  "stella", "database", "tavolozza", "codice", "razzo", "insetto", "libro", "grafico", "calendario", "telefono", "posta", "globo",
  "lampadina", "fulmine", "cuore", "bandiera", "casa", "chiave", "scudo", "strati", "scintille", "pacco", "valigetta", "bussola",
];

/** Un solo punto di Tab per gruppo (il scelto, o il primo); frecce, Home e Fine spostano il fuoco, Invio e Spazio scelgono. Su/giù saltano una riga di `colonne` celle. */
function frecce(e: KeyboardEvent<HTMLElement>) {
  const g = (e.target as HTMLElement).closest<HTMLElement>("[role=radiogroup]");
  const b = g ? [...g.querySelectorAll<HTMLElement>("[role=radio]")] : [];
  const i = b.indexOf(e.target as HTMLElement);
  if (i < 0) return;
  const colonne = b.filter((x) => x.offsetTop === b[0].offsetTop).length;
  const passo = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: colonne, ArrowUp: -colonne }[e.key];
  const j = e.key === "Home" ? 0 : e.key === "End" ? b.length - 1 : passo ? Math.min(b.length - 1, Math.max(0, i + passo)) : -1;
  if (j < 0) return;
  e.preventDefault();
  b[j].focus();
}

type Parte = { [K in keyof PreferenzeSessione]?: PreferenzeSessione[K] | null };

export function SceltaIcona({ a, pref, onImposta, onChiudi }: { a: Ancora; pref?: PreferenzeSessione; onImposta(p: Parte): void; onChiudi(): void }) {
  const [q, setQ] = useState("");
  const colore = pref?.colore ?? "grigio";
  const campo = useRef<HTMLInputElement | null>(null);
  // il pannello nasce nascosto finché non ha il suo posto: un autoFocus lì non attacca, il fuoco si prende al fotogramma dopo
  const campoRif = useCallback((el: HTMLInputElement | null) => { campo.current = el; if (el) requestAnimationFrame(() => el.focus()); }, []);
  const icone = ICONE.filter((n) => n.includes(q.trim().toLowerCase()));
  const punto = (scelto: boolean, i: number, haScelto: boolean) => (scelto || (!haScelto && i === 0) ? 0 : -1) as 0 | -1;
  return (
    <Sovrapposto ancora={a} className="scelta-icona" onChiudi={onChiudi}>
      <label className="cerca-icone">
        <Icona nome="cerca" />
        <input ref={campoRif} placeholder="Cerca icone" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <BottoneIcona icona="chiudi" etichetta="Cancella ricerca" onClick={() => { setQ(""); campo.current?.focus(); }} />}
      </label>
      <div className="t-xs secondario">Colore</div>
      <div className="campioni" role="radiogroup" aria-label="Colore" onKeyDown={frecce}>
        {COLORI.map((c, i) => (
          <button key={c} type="button" role="radio" aria-checked={c === colore} aria-label={c} title={c} tabIndex={punto(c === colore, i, true)}
            className={`campione ${c === colore ? "scelto" : ""}`} style={{ color: `var(--colore-sessione-${c})` }}
            onClick={() => onImposta({ colore: c })}>
            {c === colore && <span className="punto" />}
          </button>
        ))}
      </div>
      <div className="t-xs secondario">Icona</div>
      <div className="griglia" role="radiogroup" aria-label="Icona" onKeyDown={frecce}>
        {!icone.length && <div className="vuoto t-sm secondario">Nessuna icona</div>}
        {icone.map((n, i) => (
          <button key={n} type="button" role="radio" aria-checked={n === pref?.icona} aria-label={n} title={n} tabIndex={punto(n === pref?.icona, i, icone.includes(pref?.icona as NomeIcona))}
            className={`cella-icona ${n === pref?.icona ? "scelta" : ""}`} onClick={() => onImposta({ icona: n })}>
            <IconaSessione icona={n} colore={colore} />
          </button>
        ))}
      </div>
      <Bottone tipo="secondario" className="rimuovi" disabled={!pref?.icona && !pref?.colore} onClick={() => onImposta({ icona: null, colore: null })}>Rimuovi icona</Bottone>
    </Sovrapposto>
  );
}
