// figma: 101-16432 — «Chat clotch AI»: domande di Roberto (`parla` nel registro) e risposte di clotch AI (avvisi «risposta»), casella
// «Chiedi a clotch AI» con le sessioni da citare dopo @ (101:45260). clotch AI li monta nella sua vista (#352).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { BottoneIcona } from "../base/Bottone";
import { useElenco, usePreferenze } from "../base/dati";
import { Icona } from "../base/Icona";
import { IconaSessione } from "../base/IconaSessione";
import { useNavigazione } from "../base/navigazione";
import { SegnoStato } from "../base/SegnoStato";
import { Pezzo } from "../base/Pezzo";
import { useRegistro } from "../clotch-ai/dati";
import { MessaggioRoberto } from "./Blocchi";
import { useAvvisiSopra } from "./avvisiSopra";
import { Risposta } from "./Risposta";
import { SessioniCitate, type Citata } from "./SchedeSessioni";
import { prendiChiesta } from "./chiedi";
import { comanda } from "./clotch-ai";
import { provaDi } from "./testi";
import "./casella.css";

/** Le voci della chat con clotch AI, in ordine di tempo. */
export function useVociClotchAi() {
  const { dati: r } = useRegistro();
  return useMemo(() => {
    if (!r) return [];
    const da = r.comandi.filter((c) => c.cmd === "parla").map((c) => ({ chi: "roberto" as const, id: c.id, t: c.t ?? 0, testo: String(c.args.testo ?? "") }));
    // tutti gli avvisi di clotch AI stanno nella sua chat, non solo le risposte (101:48368: «aspetta un tuo permesso»)
    const di = r.avvisi.map((a) => ({ chi: "clotch-ai" as const, id: a.id, t: a.t ?? 0, testo: a.testo, sessioni: a.sessioni ?? [] }));
    return [...da, ...di].sort((a, b) => a.t - b.t);
  }, [r]);
}

// I componenti esportati portano il proprio scope CSS anche dentro un altro pezzo.
/** `children`: cosa aspetta Roberto in fondo al filo (i permessi delle sessioni, 101-37492). */
export function FiloClotchAi({ children }: { children?: ReactNode }) {
  const voci = useVociClotchAi();
  const elenco = useElenco().dati?.sessioni ?? [];
  const { dati: r } = useRegistro();
  // sessioni citate nella risposta: solo quelle che l'elenco conosce
  const citate = (ids: string[]): Citata[] => ids.flatMap((id) => {
    const s = elenco.find((x) => x.id === id);
    return s ? [{ s, c: r?.chat.get(id) ?? null }] : [];
  });
  const filo = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { const f = filo.current; if (f) f.scrollTop = f.scrollHeight; }, [voci.length, !!children]);
  return (
    <Pezzo nome="chat"><div className="filo" ref={filo}>
      {voci.map((v) => v.chi === "roberto" ? <MessaggioRoberto key={v.id} testo={v.testo} /> : (
        <div key={v.id} className="risposta-clotch-ai">
          <Risposta testo={v.testo} inScrittura={false} />
          <SessioniCitate citate={citate(v.sessioni)} />
        </div>
      ))}
      {children}
    </div></Pezzo>
  );
}

const MENZIONE = /@([^\s@]*)$/;

/** `microfono`: il bottone della voce di clotch AI; `spenta`: clotch AI non risponde, la casella non manda. */
export function CasellaClotchAi({ microfono, spenta = false }: { microfono?: ReactNode; spenta?: boolean }) {
  const [chiesta] = useState(prendiChiesta); // «Chiedi a clotch AI» sul testo scelto nel filo (101:28471)
  const [testo, setTesto] = useState(provaDi(useNavigazione().sezione, "scritta") ?? chiesta ?? ""); // scena di prova 101:45260
  const [scelta, setScelta] = useState(0);
  const [invio, setInvio] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const areaCasella = useRef<HTMLDivElement>(null);
  useAvvisiSopra(areaCasella);
  const elenco = useElenco().dati?.sessioni ?? [];
  const pref = usePreferenze().dati;

  useEffect(() => { const a = area.current; if (a && chiesta) { a.focus(); a.setSelectionRange(a.value.length, a.value.length); } }, []);

  const cerca = testo.match(MENZIONE)?.[1].toLowerCase();
  const trovate = cerca == null ? [] : elenco.filter((s) => s.titolo.toLowerCase().includes(cerca)).slice(0, 5);

  useLayoutEffect(() => { const a = area.current; if (a) { a.style.height = "auto"; a.style.height = `${a.scrollHeight}px`; } }, [testo]);

  const cita = (titolo: string) => { setTesto(testo.replace(MENZIONE, `@${titolo} `)); setScelta(0); area.current?.focus(); };
  const manda = async () => {
    const t = testo.trim();
    if (!t || invio || spenta) return;
    setInvio(true);
    if (await comanda("parla", { testo: t })) setTesto("");
    setInvio(false);
  };
  const tasti = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (trovate.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setScelta((scelta + (e.key === "ArrowDown" ? 1 : trovate.length - 1)) % trovate.length);
      return;
    }
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (trovate.length) cita(trovate[Math.min(scelta, trovate.length - 1)].titolo); else void manda();
  };

  const stato = spenta ? "disabilitata" : testo ? "scritta" : "vuota";
  return (
    <Pezzo nome="chat"><div className="area-casella con-menu" ref={areaCasella}>
      {trovate.length > 0 && (
        <div className="menu-sessioni" role="listbox">
          <div className="titolo-gruppo">Sessioni</div>
          {trovate.map((s, i) => (
            <button key={s.id} type="button" role="option" aria-selected={i === scelta} className={i === scelta ? "voce scelta" : "voce"}
              onMouseEnter={() => setScelta(i)} onClick={() => cita(s.titolo)}>
              <IconaSessione icona={pref[s.id]?.icona} colore={pref[s.id]?.colore} />
              <span className="etichetta">{s.titolo}</span>
              <span className="valore">{s.progetto}</span>
              <SegnoStato stato={s.stato} />
            </button>
          ))}
        </div>
      )}
      <div className={`casella ${stato}`}>
        <div className="area-testo">
          <textarea ref={area} rows={1} value={testo} disabled={spenta} onChange={(e) => { setTesto(e.target.value); setScelta(0); }} onKeyDown={tasti}
            placeholder={spenta ? "clotch AI non risponde" : "Chiedi a clotch AI"} aria-label="Chiedi a clotch AI" />
        </div>
        <div className="azioni">
          <BottoneIcona icona="piu" etichetta="Allega" disabled />
          <span className="spinta" />
          {microfono ?? <BottoneIcona icona="microfono" etichetta="Detta" disabled />}
          <button type="button" className="bottone-invia" disabled={spenta || invio || !testo.trim()} aria-label="Invia" title="Invia" onClick={() => void manda()}>
            <Icona nome="invia" colore={stato === "scritta" ? "su-accento" : "terziaria"} />
          </button>
        </div>
      </div>
    </div></Pezzo>
  );
}
