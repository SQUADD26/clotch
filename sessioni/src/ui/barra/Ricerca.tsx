// figma: 101-10247 — ricerca ⌘K: risultati (101:10247), azioni (101:23035), nessun risultato (101:23280).
import { useEffect, useMemo, useState } from "react";
import type { AzioneSessione, PreferenzeSessione, Sessione } from "../../tipi";
import { Campo } from "../base/Campo";
import { Icona, type NomeIcona } from "../base/Icona";
import { giorno, nomeSorgente } from "./elenco";
import { IconaSessione } from "./Righe";
import "./ricerca.css";

/** Azioni sulla sessione aperta, coi testi di 101:23035. */
const AZIONI: { azione: AzioneSessione; etichetta: string; icona: NomeIcona }[] = [
  { azione: "copia-link", etichetta: "Copia link alla sessione", icona: "link" },
  { azione: "copia-cartella", etichetta: "Copia cartella di lavoro", icona: "cartella" },
  { azione: "copia-id", etichetta: "Copia ID sessione", icona: "copia" },
];

type Voce = { tipo: "sessione"; s: Sessione } | { tipo: "azione"; a: (typeof AZIONI)[number] };

interface Props {
  sessioni: Sessione[];
  pref: Record<string, PreferenzeSessione>;
  aperta: string | null;
  ora: number;
  /** Solo per la prova di parità: testo già scritto. */
  iniziale?: string;
  onApri(id: string): void;
  onAzione(id: string, a: AzioneSessione): void;
  onChiudi(): void;
}

export function Ricerca({ sessioni, pref, aperta, ora, iniziale = "", onApri, onAzione, onChiudi }: Props) {
  const [q, setQ] = useState(iniziale);
  const [i, setI] = useState(0);
  const parole = q.trim().toLowerCase();
  const voci = useMemo<Voce[]>(() => [
    ...(aperta && parole ? AZIONI.filter((a) => a.etichetta.toLowerCase().includes(parole)).map((a) => ({ tipo: "azione" as const, a })) : []),
    ...sessioni.filter((s) => s.titolo.toLowerCase().includes(parole)).sort((a, b) => b.ultimaAttivita - a.ultimaAttivita).map((s) => ({ tipo: "sessione" as const, s })),
  ], [sessioni, aperta, parole]);
  useEffect(() => setI(0), [parole]);

  const scegli = (v: Voce) => {
    onChiudi();
    if (v.tipo === "sessione") onApri(v.s.id);
    else if (aperta) onAzione(aperta, v.a.azione);
  };
  const tasto = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onChiudi();
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setI((x) => (x + (e.key === "ArrowDown" ? 1 : voci.length - 1)) % Math.max(voci.length, 1));
    } else if (e.key === "Enter" && voci[i]) scegli(voci[i]);
  };
  const azioni = voci.filter((v) => v.tipo === "azione");
  const trovate = voci.filter((v) => v.tipo === "sessione");

  return (
    <div className="velo" onMouseDown={(e) => { if (e.target === e.currentTarget) onChiudi(); }}>
      <div className="finestra-ricerca" role="dialog" aria-label="Cerca sessioni" onKeyDown={tasto}>
        <Campo grande tasto="esc" placeholder="Cerca sessioni" value={q} autoFocus onChange={(e) => setQ(e.target.value)} />
        <div className="risultati">
          {!voci.length && (
            <div className="nessun-risultato">
              <Icona nome="cerca" colore="terziaria" />
              <span className="medio">Nessun risultato per «{q.trim()}»</span>
              <span className="t-sm secondario">Prova con altre parole o togli un filtro.</span>
            </div>
          )}
          {!!azioni.length && <div className="titolo-gruppo t-xs medio secondario">Azioni</div>}
          {azioni.map((v) => v.tipo === "azione" && (
            <button key={v.a.azione} type="button" className={`voce-azione ${voci[i] === v ? "scelta" : ""}`} onMouseEnter={() => setI(voci.indexOf(v))} onClick={() => scegli(v)}>
              <Icona nome={v.a.icona} />
              <span className="t-sm">{v.a.etichetta}</span>
            </button>
          ))}
          {!!trovate.length && <div className="riga titolo-sezione"><span className="testo t-sm secondario">Sessioni</span></div>}
          {trovate.map((v) => v.tipo === "sessione" && (
            <button key={v.s.id} type="button" className={`risultato ${voci[i] === v ? "scelta" : ""}`} onMouseEnter={() => setI(voci.indexOf(v))} onClick={() => scegli(v)}>
              <IconaSessione pref={pref[v.s.id]} />
              <span className="testi">
                <span className="testo">{v.s.titolo}</span>
                <span className="testo t-sm secondario">{[v.s.progetto, nomeSorgente(v.s.sorgente), v.s.account].join(" · ")}</span>
              </span>
              <span className="t-xs secondario">{giorno(v.s.ultimaAttivita, ora)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
