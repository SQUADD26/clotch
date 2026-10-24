// figma: 101-10247 — ricerca ⌘K: sessioni e messaggi (101:10247), azioni (101:23035), nessun risultato (101:23280).
import { useEffect, useMemo, useRef, useState } from "react";
import type { AzioneSessione, PreferenzeSessione, RisultatoRicerca, Sessione } from "../../tipi";
import { Campo } from "../base/Campo";
import { api } from "../base/dati";
import { Icona, type NomeIcona } from "../base/Icona";
import { Velo } from "../base/Sovrapposto";
import { nomeAccount } from "../chat/testi";
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
const dettaglio = (s: Sessione) => {
  const account = nomeAccount(s.account);
  return [s.progetto, nomeSorgente(s.sorgente), account.toLowerCase() === nomeSorgente(s.sorgente).toLowerCase() ? "" : account].filter(Boolean).join(", ");
};

/** La parola cercata in evidenza dentro un testo (#865): peso medio e colore primario. */
function Evidenzia({ testo, parole }: { testo: string; parole: string }) {
  const i = parole ? testo.toLowerCase().indexOf(parole) : -1;
  if (i < 0) return <>{testo}</>;
  return <>{testo.slice(0, i)}<mark className="trovato medio">{testo.slice(i, i + parole.length)}</mark>{testo.slice(i + parole.length)}</>;
}

/** Voci che saltano PagSu e PagGiù. */
const PAGINA = 5;

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
  const [cercando, setCercando] = useState(false);
  const [fallita, setFallita] = useState(false);
  useEffect(() => {
    let vivo = true;
    if (!parole) { setDalMain([]); setCercando(false); setFallita(false); return; }
    setCercando(true);
    // i risultati di prima restano finché non arrivano quelli nuovi: il gruppo non sparisce a ogni lettera (#869)
    cerca(parole).then((r) => { if (vivo) { setDalMain(r); setFallita(false); setCercando(false); } }, () => { if (vivo) { setFallita(true); setCercando(false); } });
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
  // la scelta fatta con le frecce resta in vista (#835); scorre solo la lista: scrollIntoView spostava anche la finestra (overflow hidden)
  const lista = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const l = lista.current, el = l?.querySelector(`#ricerca-voce-${i}`);
    if (!l || !el) return;
    const a = l.getBoundingClientRect(), b = el.getBoundingClientRect(), bordo = parseFloat(getComputedStyle(l).paddingTop);
    if (b.top < a.top + bordo) l.scrollTop -= a.top + bordo - b.top; else if (b.bottom > a.bottom - bordo) l.scrollTop += b.bottom - a.bottom + bordo;
  }, [i]);

  const scegli = (v: Voce) => {
    onChiudi();
    if (v.tipo !== "azione") onApri(v.s.id);
    else if (aperta) v.a.azione === "copia-blocco" ? void copiaUltimoBlocco(aperta) : onAzione(aperta, v.a.azione);
  };
  const tasto = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setI((x) => (x + (e.key === "ArrowDown" ? 1 : voci.length - 1)) % Math.max(voci.length, 1));
    } else if (e.key === "PageDown" || e.key === "PageUp") {
      e.preventDefault();
      setI((x) => Math.min(Math.max(x + (e.key === "PageDown" ? PAGINA : -PAGINA), 0), Math.max(voci.length - 1, 0)));
    } else if (e.key === "Enter" && voci[i]) scegli(voci[i]);
  };
  const azioni = voci.filter((v) => v.tipo === "azione");
  const trovate = voci.filter((v) => v.tipo === "sessione");
  const messaggi = voci.filter((v) => v.tipo === "messaggio");

  return (
    <Velo onChiudi={onChiudi}>
      <div className="finestra-ricerca" role="dialog" aria-label="Cerca sessioni" onKeyDown={tasto}>
        <Campo grande tasto="esc" placeholder="Cerca sessioni" value={q} autoFocus onChange={(e) => setQ(e.target.value)}
          role="combobox" aria-expanded aria-controls="ricerca-risultati" aria-activedescendant={voci[i] ? `ricerca-voce-${i}` : undefined} />
        <div ref={lista} className="risultati" id="ricerca-risultati" role="listbox" aria-label="Risultati">
          {!voci.length && !cercando && (
            <div className="nessun-risultato">
              <Icona nome="cerca" colore="terziaria" />
              {parole ? <span className="medio testo-lungo">Nessun risultato per «{q.trim()}»</span> : <span className="medio">Ancora nessuna sessione</span>}
              <span className="t-sm secondario">{parole ? "Prova con altre parole." : "Le sessioni che avvii appaiono qui."}</span>
            </div>
          )}
          {!!azioni.length && <div className="titolo-gruppo t-xs medio secondario">Azioni</div>}
          {azioni.map((v) => v.tipo === "azione" && (
            <button key={v.a.azione} type="button" role="option" id={`ricerca-voce-${voci.indexOf(v)}`} aria-selected={voci[i] === v} tabIndex={-1} className={`voce-azione ${voci[i] === v ? "scelta" : ""}`} onMouseMove={() => setI(voci.indexOf(v))} onClick={() => scegli(v)}>
              <Icona nome={v.a.icona} />
              <span className="t-sm etichetta">{v.a.etichetta}</span>
              {v.a.scorciatoia && <span className="t-sm secondario">{v.a.scorciatoia}</span>}
            </button>
          ))}
          {!!trovate.length && <div className="riga titolo-sezione"><span className="testo t-sm secondario">Sessioni</span></div>}
          {trovate.map((v) => v.tipo === "sessione" && (
            <button key={v.s.id} type="button" role="option" id={`ricerca-voce-${voci.indexOf(v)}`} aria-selected={voci[i] === v} tabIndex={-1} className={`risultato ${voci[i] === v ? "scelta" : ""}`} onMouseMove={() => setI(voci.indexOf(v))} onClick={() => scegli(v)}>
              <IconaRiga titolo={v.s.titolo} pref={pref[v.s.id]} />
              <span className="testi">
                <span className="testo"><Evidenzia testo={v.s.titolo} parole={parole} /></span>
                <span className="testo t-sm secondario"><Evidenzia testo={dettaglio(v.s)} parole={parole} /></span>
              </span>
              <span className="t-xs secondario">{giorno(v.s.ultimaAttivita, ora)}</span>
            </button>
          ))}
          {(!!messaggi.length || fallita || (cercando && !!parole)) && (
            <div className="riga titolo-sezione">
              <span className="testo t-sm secondario">Messaggi</span>
              {cercando && <span className="t-xs secondario" role="status">Cerco nei messaggi…</span>}
              {fallita && <span className="t-xs secondario" role="status">Ricerca nei messaggi non riuscita</span>}
            </div>
          )}
          {messaggi.map((v) => v.tipo === "messaggio" && (
            <button key={v.s.id} type="button" role="option" id={`ricerca-voce-${voci.indexOf(v)}`} aria-selected={voci[i] === v} tabIndex={-1} className={`risultato ${voci[i] === v ? "scelta" : ""}`} onMouseMove={() => setI(voci.indexOf(v))} onClick={() => scegli(v)}>
              <IconaRiga titolo={v.s.titolo} pref={pref[v.s.id]} />
              <span className="testi">
                <span className="testo"><Evidenzia testo={v.s.titolo} parole={parole} /></span>
                <span className="testo t-sm secondario"><Evidenzia testo={v.r.frammento.replace(/^…/, "… ").replace(/…$/, " …")} parole={parole} /></span>
              </span>
              <span className="t-xs secondario">{giorno(v.r.t ?? v.s.ultimaAttivita, ora)}</span>
            </button>
          ))}
        </div>
      </div>
    </Velo>
  );
}
