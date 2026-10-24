// figma: 101-24007 — «Avviso a comparsa» 101-10457 (Info, Successo, Errore, Caricamento), impilati sopra la casella.
// Un solo sistema per tutta l'app: `avvisa()` da qualunque pezzo, `<AreaAvvisi/>` lo disegna (la cornice lo monta).
// Entrata, uscita e pila con le View Transition di base/movimento (#520); Info e Successo si chiudono da soli dopo
// tempo/avviso. Errore e Caricamento restano finché li chiudi o li aggiorni.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { provaDi } from "../chat/testi";
import { taglia, uguale as ugualeA } from "./avvisiPila";
import { Icona, type NomeIcona } from "./Icona";
import { conTransizione } from "./movimento";
import { useNavigazione } from "./navigazione";
import { numero } from "./token";
import "./avvisi.css";

export type TipoAvviso = "info" | "successo" | "errore" | "caricamento";
export interface Avviso {
  id: number;
  tipo: TipoAvviso;
  messaggio: string;
  azione?: { etichetta: string; fai(): void };
}

const SEGNO: Record<TipoAvviso, [NomeIcona, "secondaria" | "successo" | "errore"]> = {
  info: ["info", "secondaria"], successo: ["spunta", "successo"], errore: ["avviso", "errore"], caricamento: ["spinner", "secondaria"],
};

let avvisi: Avviso[] = [];
let prossimo = 1;
const ascolta = new Set<() => void>();
// lo stato cambia subito (aggiornaAvviso subito dopo avvisa lo trova); solo il ridisegno passa dalla transizione
const cambia = (nuovi: Avviso[]) => { avvisi = nuovi; conTransizione(() => ascolta.forEach((f) => f())); };
// col mouse o il fuoco sopra l'avviso resta: chi legge o cerca il bottone non lo vede sparire; ogni aggiornamento riparte da capo (#1069)
const scadenze = new Map<number, number>();
const ferma = (id: number) => { clearTimeout(scadenze.get(id)); scadenze.delete(id); };
const timer = (a: Avviso) => {
  ferma(a.id);
  if (a.tipo !== "info" && a.tipo !== "successo") return;
  const scade = () => { if (document.querySelector(`[data-avviso="${a.id}"]:is(:hover, :focus-within)`)) scadenze.set(a.id, window.setTimeout(scade, 1000)); else chiudiAvviso(a.id); };
  scadenze.set(a.id, window.setTimeout(scade, numero("tempo-avviso")));
};

/** Mostra un avviso; torna l'id per aggiornarlo (Caricamento -> Successo) o chiuderlo. */
export function avvisa(a: Omit<Avviso, "id">): number {
  const uguale = a.tipo === "caricamento" ? undefined : avvisi.find((x) => ugualeA(x, a)); // due caricamenti uguali sono due lavori: ognuno aggiorna il suo
  if (uguale) { timer(uguale); return uguale.id; }
  const nuovo = { ...a, id: prossimo++ };
  const lista = taglia([...avvisi, nuovo]);
  avvisi.filter((x) => !lista.includes(x)).forEach((x) => ferma(x.id));
  cambia(lista);
  timer(nuovo);
  return nuovo.id;
}

export function aggiornaAvviso(id: number, parte: Partial<Omit<Avviso, "id">>) {
  const a = avvisi.find((x) => x.id === id);
  if (!a) return;
  const nuovo = { ...a, ...parte };
  cambia(avvisi.map((x) => (x.id === id ? nuovo : x)));
  timer(nuovo);
}

export function chiudiAvviso(id: number) {
  ferma(id);
  if (avvisi.some((x) => x.id === id)) cambia(avvisi.filter((x) => x.id !== id));
}

/** La pila sta in fondo al body (come ogni sovrapposto): a finestra stretta la barra laterale sopra e il suo velo non la coprono (#1131). Si centra sulla colonna in cui è scritta. */
function useColonna() {
  const segno = useRef<HTMLSpanElement>(null);
  const [stile, setStile] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    const c = segno.current?.parentElement;
    if (!c) return;
    const misura = () => {
      const r = c.getBoundingClientRect(), basso = parseFloat(getComputedStyle(c).getPropertyValue("--avvisi-basso")) || numero("spazio-4");
      setStile((v) => { const n = { left: r.left + r.width / 2, bottom: innerHeight - r.bottom + basso }; return v && v.left === n.left && v.bottom === n.bottom ? v : n; });
    };
    misura();
    const o = new ResizeObserver(misura);
    o.observe(c);
    addEventListener("resize", misura);
    return () => { o.disconnect(); removeEventListener("resize", misura); };
  }, []);
  return { segno: <span ref={segno} hidden />, stile };
}

export function AreaAvvisi() {
  const { sezione } = useNavigazione();
  const { segno, stile } = useColonna();
  // scena di prova 101:24007: i quattro avvisi del disegno, uno per tipo
  useEffect(() => {
    if (provaDi(sezione, "avvisi") === null) return;
    avvisa({ tipo: "caricamento", messaggio: "Leggendo le sessioni…" });
    avvisa({ tipo: "successo", messaggio: "Link copiato" });
    avvisa({ tipo: "errore", messaggio: "Sessione non raggiunta", azione: { etichetta: "Riprova", fai() {} } });
    avvisa({ tipo: "info", messaggio: "Sessione archiviata", azione: { etichetta: "Annulla", fai() {} } });
  }, [sezione]);
  const lista = useSyncExternalStore((f) => { ascolta.add(f); return () => ascolta.delete(f); }, () => avvisi);
  // Esc chiude l'avviso più recente, ma non ruba Esc a un dialogo o a un campo: conta solo con il fuoco sul corpo o dentro la pila
  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "Escape" || e.defaultPrevented || !avvisi.length || !(t === document.body || t.closest?.(".area-avvisi"))) return;
      chiudiAvviso(avvisi[avvisi.length - 1].id);
    };
    addEventListener("keydown", tasto);
    return () => removeEventListener("keydown", tasto);
  }, []);
  return <>{segno}{stile && createPortal(
    <div className="area-avvisi" role="status" aria-live="polite" style={stile}>
      {lista.map((a) => (
        <div key={a.id} data-avviso={a.id} className="avviso-comparsa" style={{ viewTransitionName: `avviso-${a.id}` }} role={a.tipo === "errore" ? "alert" : undefined}>
          <Icona nome={SEGNO[a.tipo][0]} colore={SEGNO[a.tipo][1]} gira={a.tipo === "caricamento"} />
          <span className="messaggio t-sm" title={a.messaggio}>{a.messaggio}</span>
          {a.azione && <button type="button" className="t-sm medio" onClick={() => { a.azione!.fai(); chiudiAvviso(a.id); }}>{a.azione.etichetta}</button>}
          <button type="button" aria-label="Chiudi" title="Chiudi" onClick={() => chiudiAvviso(a.id)}><Icona nome="chiudi" colore="terziaria" /></button>
        </div>
      ))}
    </div>, document.body)}</>;
}
