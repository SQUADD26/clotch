// figma: 101-24007 — «Avviso a comparsa» 101-10457 (Info, Successo, Errore, Caricamento), impilati sopra la casella.
// Un solo sistema per tutta l'app: `avvisa()` da qualunque pezzo, `<AreaAvvisi/>` lo disegna (la cornice lo monta).
// Durata e comparsa dal vault: ui-ux-animazioni.md § «Catalogo @keyframes» (Sonner: fade + scala 0.8↔1; si chiude da sé
// dopo il tempo base di Sonner, 4 s). Errore e Caricamento restano finché li chiudi o li aggiorni.
import { useEffect, useSyncExternalStore } from "react";
import { provaDi } from "../chat/testi";
import { Icona, type NomeIcona } from "./Icona";
import { useNavigazione } from "./navigazione";
import { numero } from "./token";
import "./avvisi.css";

export type TipoAvviso = "info" | "successo" | "errore" | "caricamento";
export interface Avviso {
  id: number;
  tipo: TipoAvviso;
  messaggio: string;
  azione?: { etichetta: string; fai(): void };
  esce?: boolean;
}

const DURATA_MS = 4000; // tempo base di Sonner (vault, sopra)
const SEGNO: Record<TipoAvviso, [NomeIcona, "secondaria" | "successo" | "errore"]> = {
  info: ["info", "secondaria"], successo: ["spunta", "successo"], errore: ["avviso", "errore"], caricamento: ["spinner", "secondaria"],
};

let avvisi: Avviso[] = [];
let prossimo = 1;
const ascolta = new Set<() => void>();
const cambia = (nuovi: Avviso[]) => { avvisi = nuovi; ascolta.forEach((f) => f()); };
const timer = (a: Avviso) => { if (a.tipo === "info" || a.tipo === "successo") setTimeout(() => chiudiAvviso(a.id), DURATA_MS); };

/** Mostra un avviso; torna l'id per aggiornarlo (Caricamento -> Successo) o chiuderlo. */
export function avvisa(a: Omit<Avviso, "id" | "esce">): number {
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
  if (!avvisi.some((x) => x.id === id && !x.esce)) return;
  cambia(avvisi.map((x) => (x.id === id ? { ...x, esce: true } : x)));
  setTimeout(() => cambia(avvisi.filter((x) => x.id !== id)), numero("tempo-normale"));
}

export function AreaAvvisi() {
  const { sezione } = useNavigazione();
  // scena di prova 101:24007: i quattro avvisi del disegno, uno per tipo
  useEffect(() => {
    if (provaDi(sezione, "avvisi") === null) return;
    avvisa({ tipo: "caricamento", messaggio: "Leggo le sessioni…" });
    avvisa({ tipo: "successo", messaggio: "Link copiato" });
    avvisa({ tipo: "errore", messaggio: "Sessione non raggiunta", azione: { etichetta: "Riprova", fai() {} } });
    avvisa({ tipo: "info", messaggio: "Sessione archiviata", azione: { etichetta: "Annulla", fai() {} } });
  }, [sezione]);
  const lista = useSyncExternalStore((f) => { ascolta.add(f); return () => ascolta.delete(f); }, () => avvisi);
  return (
    <div className="area-avvisi" role="status" aria-live="polite">
      {lista.map((a) => (
        <div key={a.id} className={`avviso-comparsa ${a.esce ? "esce" : ""}`} role={a.tipo === "errore" ? "alert" : undefined}>
          <Icona nome={SEGNO[a.tipo][0]} colore={SEGNO[a.tipo][1]} gira={a.tipo === "caricamento"} />
          <span className="messaggio t-sm">{a.messaggio}</span>
          {a.azione && <button type="button" className="t-sm medio" onClick={() => { a.azione!.fai(); chiudiAvviso(a.id); }}>{a.azione.etichetta}</button>}
          <button type="button" aria-label="Chiudi" onClick={() => chiudiAvviso(a.id)}><Icona nome="chiudi" colore="terziaria" /></button>
        </div>
      ))}
    </div>
  );
}
