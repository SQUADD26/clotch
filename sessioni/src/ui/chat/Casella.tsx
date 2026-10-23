// figma: 101-43332 — «Casella di scrittura» 101:7407 (Vuota, Scritta, Fuoco, In corso, Disabilitata), «Messaggio in coda» 101:13488,
// coda (101:14849), modifica della voce (101:43708), «invia ora» (101:43945), Invio diretto (101:43535).
// Mentre la sessione lavora: ↵ interrompe e manda subito (`manda` modo subito), ⌘↵ mette in coda (`manda` modo coda).
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BottoneIcona } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { comanda } from "./friday";
import { provaDi, quanti } from "./testi";
import "./casella.css";

export interface VoceCoda { voce: string; testo: string }

/** «claude-opus-5-5» -> «Opus 5.5», come «chip modello» e l'intestazione. */
export const nomeModello = (m: string | null) => {
  const x = m?.match(/^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/);
  return x ? `${x[1][0].toUpperCase()}${x[1].slice(1)} ${x[2]}${x[3] ? `.${x[3]}` : ""}` : m;
};

const Tasto = ({ t }: { t: string }) => <span className="tasto">{t}</span>;

function Coda({ voci, modifica, onModifica, chat, suggerimento }: {
  voci: VoceCoda[]; modifica: string | null; onModifica(v: VoceCoda): void; chat: string; suggerimento: boolean;
}) {
  const subito = async (v: VoceCoda) => { if (await comanda("manda", { chat, testo: v.testo, modo: "subito" })) await comanda("coda_togli", { chat, voce: v.voce }); };
  return (
    <div className="coda">
      {voci.map((v, i) => (
        <div key={v.voce} className={modifica === v.voce ? "messaggio-in-coda in-modifica" : "messaggio-in-coda"}>
          {i === 0 && <span className="etichetta">{quanti(voci.length, "messaggio in coda", "messaggi in coda")}</span>}
          <span className="testo">{v.testo}</span>
          <div className="azioni">
            <span className={suggerimento && i === 0 ? "con-suggerimento sopra visibile" : "con-suggerimento sopra"}>
              <BottoneIcona icona="invia-ora" etichetta="Interrompi e manda ora" onClick={() => subito(v)} />
              <span className="suggerimento">Interrompi e manda ora <Tasto t="↵" /></span>
            </span>
            <BottoneIcona icona="matita" etichetta="Modifica" onClick={() => onModifica(v)} />
            <BottoneIcona icona="chiudi" etichetta="Rimuovi" onClick={() => comanda("coda_togli", { chat, voce: v.voce })} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** `segnaposto`: «In attesa della sessione» (101:15993), «Riparte alle 18:00» (101:16211); di solito «Scrivi alla sessione». */
/** `prova`: stato di una scena di prova: «scritta:<testo>» (101:43332), «modifica» della prima in coda (101:43708), «suggerimento» (101:43945). */
export function Casella({ chat, lavora, coda, modello, disabilitata, segnaposto = "Scrivi alla sessione", prova = null, appenaMandato = false }: {
  chat: string; lavora: boolean; coda: VoceCoda[]; modello: string | null; disabilitata: boolean; segnaposto?: string; prova?: string | null;
  /** Roberto ha appena interrotto e mandato (101:43535): i tasti restano sotto la casella. */
  appenaMandato?: boolean;
}) {
  const inModifica = provaDi(prova, "modifica") !== null ? coda[0] ?? null : null;
  const [testo, setTesto] = useState(provaDi(prova, "scritta") ?? inModifica?.testo ?? "");
  const [modifica, setModifica] = useState<VoceCoda | null>(inModifica);
  const [invio, setInvio] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  // la casella cresce col testo (101:25542 «testo lungo»)
  useEffect(() => { const a = area.current; if (a) { a.style.height = "auto"; a.style.height = `${a.scrollHeight}px`; } }, [testo]);

  const manda = async (modo: "subito" | "coda") => {
    const t = testo.trim();
    if (!t || invio) return;
    setInvio(true);
    const ok = modifica
      ? modo === "coda"
        ? await comanda("coda_modifica", { chat, voce: modifica.voce, testo: t })
        : (await comanda("manda", { chat, testo: t, modo: "subito" })) && (await comanda("coda_togli", { chat, voce: modifica.voce }))
      : await comanda("manda", { chat, testo: t, modo: lavora ? modo : "subito" });
    setInvio(false);
    if (ok) { setTesto(""); setModifica(null); }
  };

  const tasti = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape" && modifica) { setModifica(null); setTesto(""); return; }
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void manda(e.metaKey ? "coda" : "subito");
  };

  const ferma = lavora && !testo.trim();
  const altre = coda.filter((v) => v.voce !== modifica?.voce); // quella in modifica sta nella casella
  const stato = disabilitata ? "disabilitata" : ferma ? "in-corso" : testo ? "scritta" : "vuota";
  return (
    <div className="area-casella">
      {altre.length > 0 && <Coda voci={altre} chat={chat} suggerimento={provaDi(prova, "suggerimento") !== null} modifica={modifica?.voce ?? null} onModifica={(v) => { setModifica(v); setTesto(v.testo); area.current?.focus(); }} />}
      {modifica && (
        <div className="nota-casella"><Icona nome="matita" /><span>Modifichi il messaggio in coda. ⌘↵ lo rimette in coda.</span></div>
      )}
      <div className={`casella ${stato}${modifica ? " fuoco" : ""}`}>
        <div className="area-testo">
          <textarea ref={area} rows={1} value={testo} disabled={disabilitata} onChange={(e) => setTesto(e.target.value)} onKeyDown={tasti}
            placeholder={disabilitata ? "Rispondi da Cursor" : segnaposto} aria-label={segnaposto} />
        </div>
        <div className="azioni">
          <BottoneIcona icona="piu" etichetta="Allega" disabled />
          <span className="chip"><Icona nome="mano" /><span className="etichetta">Chiedi approvazione</span><Icona nome="giu" /></span>
          <span className="spinta" />
          {nomeModello(modello) && <span className="chip"><span className="modello">{nomeModello(modello)}</span></span>}
          <BottoneIcona icona="microfono" etichetta="Detta" disabled />
          <button type="button" className="bottone-invia" disabled={disabilitata || invio || (!ferma && !testo.trim())}
            aria-label={ferma ? "Interrompi" : "Invia"} title={ferma ? "Interrompi" : "Invia"}
            onClick={() => (ferma ? comanda("interrompi", { chat }) : manda("subito"))}>
            <Icona nome={ferma ? "stop" : "invia"} colore={stato === "vuota" || stato === "disabilitata" ? "terziaria" : "su-accento"} />
          </button>
        </div>
      </div>
      {/* i tasti servono mentre scrivi, con messaggi in coda o subito dopo «interrompi e manda» (101:14849, 43332, 43535) */}
      {lavora && !disabilitata && (testo || coda.length > 0 || appenaMandato) && (
        <div className="tasti-casella">
          <Tasto t="↵" /><span>interrompe e manda subito</span>
          <Tasto t="⌘↵" /><span>mette in coda</span>
        </div>
      )}
    </div>
  );
}
