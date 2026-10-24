// figma: 149-66688 — «dialogo silenzio»: «Dalle» e «Alle» con ore e minuti a segmenti e frecce su/giù (oltre la mezzanotte 149-66904, inizio = fine 149-67120).
import { Fragment, useRef, useState, type KeyboardEvent } from "react";
import { Bottone } from "../base/Bottone";
import { Dialogo } from "../base/Dialogo";
import { chiudiDialogo, type DatiDialoghi } from "../base/dialoghi";
import { Icona } from "../base/Icona";

export type Ora = [number, number]; // [ore, minuti]
const MAX = [23, 59];
const due = (n: number) => String(n).padStart(2, "0");
const minuti = ([h, m]: Ora) => h * 60 + m;

/** «22:00–7:00» -> [[22, 0], [7, 0]]; un testo che non è un intervallo di ore (es. «Mai») riparte da 22:00–7:00. */
export function leggiOre(testo: string): [Ora, Ora] {
  const m = /^(\d{1,2}):(\d{2})–(\d{1,2}):(\d{2})$/.exec(testo);
  return m && +m[1] <= 23 && +m[3] <= 23 && +m[2] <= 59 && +m[4] <= 59 ? [[+m[1], +m[2]], [+m[3], +m[4]]] : [[22, 0], [7, 0]];
}
/** Il formato della riga «Silenzio»: ore senza zero davanti, minuti a due cifre. */
export const scriviOre = ([a, b]: [Ora, Ora]) => `${a[0]}:${due(a[1])}–${b[0]}:${due(b[1])}`;
/** Un passo su o giù con il giro: 23 -> 0 e 59 -> 0 (i minuti non toccano le ore). */
export const passo = (v: number, verso: 1 | -1, segmento: number) => (v + verso + MAX[segmento] + 1) % (MAX[segmento] + 1);
/** La fine è prima dell'inizio: la fascia passa la mezzanotte. */
export const delGiornoDopo = ([a, b]: [Ora, Ora]) => minuti(b) < minuti(a);

export function DialogoOre({ valore, attivo = [0, 0], salva }: DatiDialoghi["ore"]) {
  const [ore, setOre] = useState(() => leggiOre(valore));
  const [att, setAtt] = useState<[number, number] | null>(attivo);
  const segmenti = useRef<(HTMLElement | null)[]>([]);
  const scritto = useRef(""); // le cifre digitate nel segmento in corso
  const uguali = minuti(ore[0]) === minuti(ore[1]);
  const metti = (r: number, s: number, f: (v: number) => number) =>
    setOre((p) => p.map((o, i) => (i === r ? o.map((v, j) => (j === s ? f(v) : v)) : o)) as [Ora, Ora]);
  const fai = () => { if (!uguali) { salva(scriviOre(ore)); chiudiDialogo(); } };
  const tasto = (e: KeyboardEvent, r: number, s: number) => {
    if (e.key === "Enter") { e.preventDefault(); fai(); }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); metti(r, s, (v) => passo(v, e.key === "ArrowUp" ? 1 : -1, s)); }
    else if (/^\d$/.test(e.key) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      let c = scritto.current + e.key;
      if (+c > MAX[s]) c = e.key;
      scritto.current = c;
      metti(r, s, () => +c);
      if (c.length === 2 || +c * 10 > MAX[s]) { scritto.current = ""; segmenti.current[r * 2 + s + 1]?.focus(); } // segmento pieno: si passa al successivo
    }
  };
  const riga = (r: number, nome: string, dopo?: string) => (
    <div className="riga-ora">
      <span className="t-base secondario nome-ora">{nome}</span>
      <div className={att?.[0] === r ? "selettore-ora fuoco" : "selettore-ora"} role="group" aria-label={nome}>
        {[0, 1].map((s) => (
          <Fragment key={s}>
            {s === 1 && <span>:</span>}
            <span ref={(el) => { segmenti.current[r * 2 + s] = el; }} className={att?.[0] === r && att[1] === s ? "segmento scelto" : "segmento"}
              role="spinbutton" tabIndex={0} aria-label={`${nome}, ${s ? "minuti" : "ore"}`} aria-valuemin={0} aria-valuemax={MAX[s]} aria-valuenow={ore[r][s]}
              data-fuoco={attivo[0] === r && attivo[1] === s ? "" : undefined}
              onFocus={() => { scritto.current = ""; setAtt([r, s]); }} onBlur={() => setAtt(null)} onKeyDown={(e) => tasto(e, r, s)}>{due(ore[r][s])}</span>
          </Fragment>
        ))}
        <div className="frecce">
          {([1, -1] as const).map((v) => (
            <button key={v} type="button" tabIndex={-1} className={v === 1 ? "freccia su" : "freccia"} aria-label={`${v === 1 ? "Aumenta" : "Diminuisci"} ${nome.toLowerCase()}`}
              onMouseDown={(e) => e.preventDefault()} onClick={() => { const s = att?.[0] === r ? att[1] : 0; metti(r, s, (x) => passo(x, v, s)); }}><Icona nome="giu" /></button>
          ))}
        </div>
      </div>
      {dopo && <span className="t-sm secondario">{dopo}</span>}
    </div>
  );
  return (
    <Dialogo titolo="Quando non vuoi ricevere notifiche?" onChiudi={chiudiDialogo}
      bottoni={<><Bottone tipo="secondario" onClick={chiudiDialogo}>Annulla</Bottone><Bottone disabled={uguali} onClick={fai}>Salva</Bottone></>}>
      {riga(0, "Dalle")}
      {riga(1, "Alle", delGiornoDopo(ore) ? "del giorno dopo" : undefined)}
      {uguali ? <div className="t-sm errore-ore" role="alert">Inizio e fine sono uguali. Scegli due orari diversi.</div> : <div className="t-sm secondario">Niente notifiche in queste ore.</div>}
    </Dialogo>
  );
}
