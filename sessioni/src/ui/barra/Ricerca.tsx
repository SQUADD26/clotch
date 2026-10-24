// figma: 101-10247 — ricerca ⌘K: sessioni e messaggi (101:10247), azioni (101:23035), nessun risultato (101:23280).
import { useEffect, useMemo, useState } from "react";
import type { AzioneSessione, PreferenzeSessione, RisultatoRicerca, Sessione } from "../../tipi";
import { Campo } from "../base/Campo";
import { api } from "../base/dati";
import { Icona, type NomeIcona } from "../base/Icona";
import { Velo } from "../base/Sovrapposto";
import { giorno, nomeSorgente } from "./elenco";
import { IconaRiga } from "./Righe";
import "./ricerca.css";

/** Azioni sulla sessione aperta, coi testi di 101:23035. */
const AZIONI: { azione: AzioneSessione | "copia-blocco"; etichetta: string; icona: NomeIcona; scorciatoia?: string }[] = [
  { azione: "copia-link", etichetta: "Copia link alla sessione", icona: "link" },
  { azione: "copia-cartella", etichetta: "Copia cartella di lavoro", icona: "cartella" },
  { azione: "copia-id", etichetta: "Copia ID sessione", icona: "copia" },
  { azione: "copia-blocco", etichetta: "Copia ultimo blocco di codice", icona: "codice", scorciatoia: "⇧⌘;" },
];

/** L'ultimo blocco ``` di una risposta dell'assistente, negli ultimi messaggi della sessione, negli appunti. */
export async function copiaUltimoBlocco(id: string) {
  const { messaggi } = await api().messaggi(id, 0);
  for (const m of [...messaggi].reverse()) {
    const blocchi = m.tipo === "assistente" ? [...m.testo.matchAll(/```[^\n]*\n([\s\S]*?)```/g)] : [];
    if (blocchi.length) return navigator.clipboard.writeText(blocchi[blocchi.length - 1][1].replace(/\n$/, ""));
  }
}

/** «clotch-ai-mac-v2 · Codex»: l'account solo se non è il nome della sorgente (101:10247). */
const dettaglio = (s: Sessione) =>
  [s.progetto, nomeSorgente(s.sorgente), s.account.toLowerCase() === nomeSorgente(s.sorgente).toLowerCase() ? "" : s.account].filter(Boolean).join(" · ");

type Voce = { tipo: "sessione"; s: Sessione } | { tipo: "messaggio"; s: Sessione; r: RisultatoRicerca } | { tipo: "azione"; a: (typeof AZIONI)[number] };

interface Props {
  sessioni: Sessione[];
  pref: Record<string, PreferenzeSessione>;
  aperta: string | null;
  ora: number;
  /** Solo per la prova di parità: testo già scritto e risposta del main. */
  iniziale?: string;
  cerca?(testo: string): Promise<RisultatoRicerca[]>;
  onApri(id: string): void;
  onAzione(id: string, a: AzioneSessione): void;
  onChiudi(): void;
}

export function Ricerca({ sessioni, pref, aperta, ora, iniziale = "", cerca = (t) => api().cerca(t), onApri, onAzione, onChiudi }: Props) {
  const [q, setQ] = useState(iniziale);
  const [i, setI] = useState(0);
  const parole = q.trim().toLowerCase();
  // «Messaggi»: le sessioni che il main trova solo nel testo; i titoli si cercano qui, senza aspettarlo
  const [dalMain, setDalMain] = useState<RisultatoRicerca[]>([]);
  useEffect(() => {
    let vivo = true;
    setDalMain([]);
    if (parole) cerca(parole).then((r) => { if (vivo) setDalMain(r); }, () => {});
    return () => { vivo = false; };
  }, [parole]);
  const voci = useMemo<Voce[]>(() => {
    const perId = new Map(sessioni.map((s) => [s.id, s]));
    return [
      ...(aperta && parole ? AZIONI.filter((a) => a.etichetta.toLowerCase().includes(parole)).map((a) => ({ tipo: "azione" as const, a })) : []),
      ...sessioni.filter((s) => s.titolo.toLowerCase().includes(parole)).sort((a, b) => b.ultimaAttivita - a.ultimaAttivita).map((s) => ({ tipo: "sessione" as const, s })),
      ...dalMain.filter((r) => !r.nelTitolo && perId.has(r.id)).map((r) => ({ tipo: "messaggio" as const, s: perId.get(r.id)!, r })),
    ];
  }, [sessioni, aperta, parole, dalMain]);
  useEffect(() => setI(0), [parole]);

  const scegli = (v: Voce) => {
    onChiudi();
    if (v.tipo !== "azione") onApri(v.s.id);
    else if (aperta) v.a.azione === "copia-blocco" ? void copiaUltimoBlocco(aperta) : onAzione(aperta, v.a.azione);
  };
  const tasto = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setI((x) => (x + (e.key === "ArrowDown" ? 1 : voci.length - 1)) % Math.max(voci.length, 1));
    } else if (e.key === "Enter" && voci[i]) scegli(voci[i]);
  };
  const azioni = voci.filter((v) => v.tipo === "azione");
  const trovate = voci.filter((v) => v.tipo === "sessione");
  const messaggi = voci.filter((v) => v.tipo === "messaggio");

  return (
    <Velo onChiudi={onChiudi}>
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
              <span className="t-sm etichetta">{v.a.etichetta}</span>
              {v.a.scorciatoia && <span className="t-sm secondario">{v.a.scorciatoia}</span>}
            </button>
          ))}
          {!!trovate.length && <div className="riga titolo-sezione"><span className="testo t-sm secondario">Sessioni</span></div>}
          {trovate.map((v) => v.tipo === "sessione" && (
            <button key={v.s.id} type="button" className={`risultato ${voci[i] === v ? "scelta" : ""}`} onMouseEnter={() => setI(voci.indexOf(v))} onClick={() => scegli(v)}>
              <IconaRiga titolo={v.s.titolo} pref={pref[v.s.id]} />
              <span className="testi">
                <span className="testo">{v.s.titolo}</span>
                <span className="testo t-sm secondario">{dettaglio(v.s)}</span>
              </span>
              <span className="t-xs secondario">{giorno(v.s.ultimaAttivita, ora)}</span>
            </button>
          ))}
          {!!messaggi.length && <div className="riga titolo-sezione"><span className="testo t-sm secondario">Messaggi</span></div>}
          {messaggi.map((v) => v.tipo === "messaggio" && (
            <button key={v.s.id} type="button" className={`risultato ${voci[i] === v ? "scelta" : ""}`} onMouseEnter={() => setI(voci.indexOf(v))} onClick={() => scegli(v)}>
              <IconaRiga titolo={v.s.titolo} pref={pref[v.s.id]} />
              <span className="testi">
                <span className="testo">{v.s.titolo}</span>
                <span className="testo t-sm secondario">{v.r.frammento.replace(/^…/, "… ").replace(/…$/, " …")}</span>
              </span>
              <span className="t-xs secondario">{giorno(v.r.t ?? v.s.ultimaAttivita, ora)}</span>
            </button>
          ))}
        </div>
      </div>
    </Velo>
  );
}
