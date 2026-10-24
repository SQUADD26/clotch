// figma: 101-24007 — «Avviso a comparsa» 101-10457 (Info, Successo, Errore, Caricamento), impilati sopra la casella.
// Un solo sistema per tutta l'app: `avvisa()` da qualunque pezzo, `<AreaAvvisi/>` lo disegna (la cornice lo monta).
// Entrata, uscita e pila con le View Transition di base/movimento (#520); Info e Successo si chiudono da soli dopo
// attesa/avviso. Errore e Caricamento restano finché li chiudi o li aggiorni.
import { useSyncExternalStore } from "react";
import { Icona, type NomeIcona } from "./Icona";
import { conTransizione } from "./movimento";
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
const timer = (a: Avviso) => { if (a.tipo === "info" || a.tipo === "successo") setTimeout(() => chiudiAvviso(a.id), numero("attesa-avviso")); };

/** Mostra un avviso; torna l'id per aggiornarlo (Caricamento -> Successo) o chiuderlo. */
export function avvisa(a: Omit<Avviso, "id">): number {
  const nuovo = { ...a, id: prossimo++ };
  cambia([...avvisi, nuovo]);
  timer(nuovo);
  return nuovo.id;
}

export function aggiornaAvviso(id: number, parte: Partial<Omit<Avviso, "id">>) {
  const a = avvisi.find((x) => x.id === id);
  if (!a) return;
  const nuovo = { ...a, ...parte };
  cambia(avvisi.map((x) => (x.id === id ? nuovo : x)));
  if (parte.tipo && parte.tipo !== a.tipo) timer(nuovo);
}

export function chiudiAvviso(id: number) {
  if (avvisi.some((x) => x.id === id)) cambia(avvisi.filter((x) => x.id !== id));
}

export function AreaAvvisi() {
  const lista = useSyncExternalStore((f) => { ascolta.add(f); return () => ascolta.delete(f); }, () => avvisi);
  return (
    <div className="area-avvisi" role="status" aria-live="polite">
      {lista.map((a) => (
        <div key={a.id} className="avviso-comparsa" style={{ viewTransitionName: `avviso-${a.id}` }} role={a.tipo === "errore" ? "alert" : undefined}>
          <Icona nome={SEGNO[a.tipo][0]} colore={SEGNO[a.tipo][1]} gira={a.tipo === "caricamento"} />
          <span className="messaggio t-sm">{a.messaggio}</span>
          {a.azione && <button type="button" className="t-sm medio" onClick={() => { a.azione!.fai(); chiudiAvviso(a.id); }}>{a.azione.etichetta}</button>}
          <button type="button" aria-label="Chiudi" onClick={() => chiudiAvviso(a.id)}><Icona nome="chiudi" colore="terziaria" /></button>
        </div>
      ))}
    </div>
  );
}
