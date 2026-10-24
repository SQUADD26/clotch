// figma: 101-26745 — «menu comandi» 101:27015 (titolo «Comandi», riga scelta, comando in carattere da codice e descrizione);
// 101-27018 — «menu file» 101:27276 (titolo «File», icona e percorso). Sta sopra la casella e non ruba il fuoco al testo.
import { useEffect, useRef, useState } from "react";
import type { VoceComando } from "../../tipi";
import { api } from "../base/dati";
import { Icona } from "../base/Icona";
import { filtraComandi, type Cerca } from "./cerca-casella";
import "./scelte.css";

export type Voce = VoceComando | { nome: string };

const comandi = new Map<string, { t: number; p: Promise<VoceComando[]> }>();
/** I comandi della chat, letti dal disco al più ogni 30 s: una skill nuova compare presto, ma non a ogni tasto. */
function leggiComandi(chat: string) {
  const c = comandi.get(chat);
  if (c && Date.now() - c.t < 30_000) return c.p;
  const p = api().comandi(chat).catch(() => { comandi.delete(chat); return [] as VoceComando[]; });
  comandi.set(chat, { t: Date.now(), p });
  return p;
}

/** Le voci per la ricerca di adesso: comandi (filtrati qui) o file (una richiesta al main per ricerca, vale l'ultima).
 *  `stato`: «carica» finché la risposta non è di questa ricerca, «errore» se il main non ha saputo cercare. */
export function useVoci(chat: string, c: Cerca | null): { voci: Voce[]; stato: "carica" | "pronto" | "errore" } {
  const [dati, setDati] = useState<{ k: string; v: Voce[]; errore?: boolean }>({ k: "", v: [] });
  const k = c ? `${c.tipo}\0${c.query}` : "";
  useEffect(() => {
    if (!c) return;
    let vivo = true;
    const voci: Promise<Voce[]> = c.tipo === "comando"
      ? leggiComandi(chat).then((v) => filtraComandi(v, c.query))
      : api().file(chat, c.query).then((f) => f.map((nome) => ({ nome })));
    void voci.then((v) => { if (vivo) setDati({ k, v }); }, () => { if (vivo) setDati({ k, v: [], errore: true }); });
    return () => { vivo = false; };
  }, [chat, k]);
  return dati.k !== k ? { voci: [], stato: "carica" } : { voci: dati.v, stato: dati.errore ? "errore" : "pronto" };
}

/** Il menu sopra la casella; `onScegli` riceve il nome della voce. I tasti (frecce, Invio, Esc) li gestisce la casella. */
export function Suggerimenti({ tipo, voci, stato, scelta, onScelta, onScegli }: {
  tipo: Cerca["tipo"]; voci: Voce[]; stato: "carica" | "pronto" | "errore"; scelta: number; onScelta(i: number): void; onScegli(nome: string): void;
}) {
  const scelto = useRef<HTMLButtonElement>(null);
  useEffect(() => { scelto.current?.scrollIntoView({ block: "nearest" }); }, [scelta, voci]);
  if (!voci.length) {
    const testo = stato === "carica" ? "Cercando…" : stato === "errore" ? "Ricerca non riuscita" : tipo === "file" ? "Nessun file" : "Nessun comando";
    return <div className="menu-casella suggerimenti" role="status" onMouseDown={(e) => e.preventDefault()}><div className="vuoto-menu">{testo}</div></div>;
  }
  const gruppi = tipo === "file" ? [["File", voci]] as const : (["Comandi", "Skill"] as const).map((g) => [g, voci.filter((v) => "gruppo" in v && v.gruppo === g)] as const);
  return (
    <div className="menu-casella suggerimenti" role="listbox" onMouseDown={(e) => e.preventDefault()}>
      {gruppi.filter(([, v]) => v.length).map(([titolo, v]) => (
        <div key={titolo} role="group" aria-label={titolo}>
          <div className="titolo-gruppo">{titolo}</div>
          {v.map((x) => {
            const i = voci.indexOf(x);
            return (
              <button key={x.nome} ref={i === scelta ? scelto : undefined} type="button" role="option" title={x.nome} aria-selected={i === scelta} className={i === scelta ? "voce scelta" : "voce"}
                onMouseEnter={() => onScelta(i)} onClick={() => onScegli(x.nome)}>
                {tipo === "file" ? <Icona nome="file" /> : <span className="comando codice">{x.nome}</span>}
                {tipo === "file" ? <span className="etichetta"><span className="cartella">{x.nome.slice(0, x.nome.lastIndexOf("/") + 1)}</span><span className="nome">{x.nome.slice(x.nome.lastIndexOf("/") + 1)}</span></span> : <span className="descrizione">{"descrizione" in x ? x.descrizione : ""}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
