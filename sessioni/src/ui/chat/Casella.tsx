// figma: 101-43332 — «Casella di scrittura» 101:7407 (Vuota, Scritta, Fuoco, In corso, Disabilitata), «Messaggio in coda» 101:13488,
// coda (101:14849), modifica della voce (101:43708), «invia ora» (101:43945), Invio diretto (101:43535).
// Mentre la sessione lavora: ↵ interrompe e manda subito (`manda` modo subito), ⌘↵ mette in coda (`manda` modo coda).
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { FileAllegato } from "../../tipi";
import { avvisa } from "../base/Avvisi";
import { BottoneIcona } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { registraAzione } from "../base/scorciatoie";
import { useImpostazioni } from "../impostazioni/stato";
import { azioneDi, tastiDi } from "../impostazioni/tasti";
import { Aggiungi } from "./Aggiungi";
import { ChipAllegato } from "./Allegati";
import { comanda } from "./friday";
import { casella, conPercorsi } from "./percorsi";
import { useBozza } from "./bozze";
import { argsManda, provaDi, quanti } from "./testi";
import "./casella.css";

export interface VoceCoda { voce: string; testo: string }

/** «claude-opus-5-5» -> «Opus 5.5», come «chip modello» e l'intestazione. */
export const nomeModello = (m: string | null) => {
  const x = m?.match(/^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/);
  return x ? `${x[1][0].toUpperCase()}${x[1].slice(1)} ${x[2]}${x[3] ? `.${x[3]}` : ""}` : m;
};

const Tasto = ({ t }: { t: string }) => <span className="tasto">{t}</span>;

function Coda({ voci, modifica, onModifica, chat, suggerimento, attuale }: {
  voci: VoceCoda[]; modifica: string | null; onModifica(v: VoceCoda): void; chat: string; suggerimento: boolean; attuale: string | null;
}) {
  const { modello } = useImpostazioni();
  const subito = async (v: VoceCoda) => { if (await comanda("manda", argsManda(chat, v.testo, "subito", modello, attuale))) await comanda("coda_togli", { chat, voce: v.voce }); };
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
/** `prova`: stato di una scena di prova: «scritta:<testo>» (101:43332), «modifica» della prima in coda (101:43708), «suggerimento» (101:43945),
 *  «menu-aggiungi» (101:25845), «rilascio» (101:27294). `account`: la cartella dell'account della sessione, per le sue skill. */
export function Casella({ chat, lavora, coda, modello, disabilitata, segnaposto = "Scrivi alla sessione", prova = null, appenaMandato = false, account = "" }: {
  chat: string; lavora: boolean; coda: VoceCoda[]; modello: string | null; disabilitata: boolean; segnaposto?: string; prova?: string | null; account?: string;
  /** Roberto ha appena interrotto e mandato (101:43535): i tasti restano sotto la casella. */
  appenaMandato?: boolean;
}) {
  const inModifica = provaDi(prova, "modifica") !== null ? coda[0] ?? null : null;
  const { testo, modifica, invio, bozza } = useBozza(chat, provaDi(prova, "scritta") ?? inModifica?.testo ?? "", inModifica);
  const area = useRef<HTMLTextAreaElement>(null);
  const { scorciatoie, modello: preferenza } = useImpostazioni();
  const [allegati, setAllegati] = useState<FileAllegato[]>([]);
  const [menu, setMenu] = useState(() => provaDi(prova, "menu-aggiungi") !== null);
  const [trascina, setTrascina] = useState(() => provaDi(prova, "rilascio") !== null);
  const unisci = (nuovi: FileAllegato[]) => setAllegati((x) => [...x, ...nuovi.filter((n, i) => !x.some((y) => y.percorso === n.percorso) && nuovi.findIndex((m) => m.percorso === n.percorso) === i)]);
  const allega = async () => unisci(await casella().scegli().catch(() => []));
  /** «/goal », «/plan », «/<skill> »: il comando va in testa al messaggio, al posto di un altro già scritto. */
  const comando = (c: string) => { bozza.scrivi(c + testo.replace(/^\/\S*\s*/, "")); area.current?.focus(); };

  useEffect(() => (lavora && !disabilitata ? registraAzione("ferma", () => void comanda("interrompi", { chat })) : undefined), [lavora, disabilitata, chat]);

  // la casella cresce col testo (101:25542 «testo lungo»)
  useEffect(() => { const a = area.current; if (a) { a.style.height = "auto"; a.style.height = `${a.scrollHeight}px`; } }, [testo]);

  // file trascinati sulla finestra: la zona di rilascio sulla casella; fuori dalla casella non si apre il file al posto dell'app
  const aggiungi = useRef((_: string[]) => {});
  aggiungi.current = async (percorsi) => {
    const trovati = percorsi.length ? await casella().descrivi(percorsi).catch(() => []) : [];
    if (trovati.length < percorsi.length) avvisa({ tipo: "errore", messaggio: "File non letto" });
    unisci(trovati);
  };
  useEffect(() => {
    if (disabilitata) return;
    let dentro = 0;
    const file = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
    const entra = (e: DragEvent) => { if (file(e)) { dentro++; setTrascina(true); } };
    const esce = (e: DragEvent) => { if (file(e) && --dentro <= 0) { dentro = 0; setTrascina(false); } };
    const sopra = (e: DragEvent) => { if (file(e)) e.preventDefault(); };
    const lascia = (e: DragEvent) => {
      if (!file(e)) return;
      e.preventDefault();
      dentro = 0;
      setTrascina(false);
      aggiungi.current([...e.dataTransfer!.files].map((f) => casella().percorso(f)).filter(Boolean));
    };
    const eventi = { dragenter: entra, dragleave: esce, dragover: sopra, drop: lascia };
    for (const [n, f] of Object.entries(eventi)) addEventListener(n, f as EventListener);
    return () => { for (const [n, f] of Object.entries(eventi)) removeEventListener(n, f as EventListener); };
  }, [disabilitata]);

  const manda = async (modo: "subito" | "coda") => {
    const richiesta = bozza.inizia();
    if (!richiesta) return;
    const t = conPercorsi(richiesta.testo.trim(), allegati.map((a) => a.percorso)), modifica = richiesta.modifica;
    let ok = false;
    try {
      ok = modifica
        ? modo === "coda"
          ? await comanda("coda_modifica", { chat, voce: modifica.voce, testo: t })
          : (await comanda("manda", argsManda(chat, t, "subito", preferenza, modello))) && (await comanda("coda_togli", { chat, voce: modifica.voce }))
        : await comanda("manda", argsManda(chat, t, lavora ? modo : "subito", preferenza, modello));
    } finally { richiesta.finisci(ok); if (ok) setAllegati([]); }
  };

  const tasti = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape" && modifica) { bozza.esci(); return; }
    if (e.nativeEvent.isComposing) return;
    if (e.metaKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "u") { e.preventDefault(); void allega(); return; } // «Allega file o cartelle…» ⌘U
    if (e.key === "Tab" && e.shiftKey) { e.preventDefault(); comando("/plan "); return; } // «Modalità piano» ⇧⇥
    const azione = azioneDi(tastiDi(e.nativeEvent), scorciatoie);
    if (azione !== "inviaInterrompi" && azione !== "coda") return;
    e.preventDefault();
    void manda(azione === "coda" ? "coda" : "subito");
  };

  const ferma = lavora && !testo.trim();
  const altre = coda.filter((v) => v.voce !== modifica?.voce); // quella in modifica sta nella casella
  const stato = disabilitata ? "disabilitata" : ferma ? "in-corso" : testo ? "scritta" : "vuota";
  return (
    <div className="area-casella">
      {altre.length > 0 && <Coda voci={altre} chat={chat} attuale={modello}suggerimento={provaDi(prova, "suggerimento") !== null} modifica={modifica?.voce ?? null} onModifica={(v) => { bozza.modifica(v); area.current?.focus(); }} />}
      {modifica && (
        <div className="nota-casella"><Icona nome="matita" /><span>Modifichi il messaggio in coda. ⌘↵ lo rimette in coda.</span></div>
      )}
      <div className={`casella ${stato}${modifica || menu ? " fuoco" : ""}`}>
        {allegati.length > 0 && (
          <div className="allegati-casella">
            {allegati.map((a) => <ChipAllegato key={a.percorso} a={a} onRimuovi={() => setAllegati((x) => x.filter((y) => y !== a))} />)}
          </div>
        )}
        <div className="area-testo">
          <textarea ref={area} rows={1} value={testo} disabled={disabilitata} onChange={(e) => bozza.scrivi(e.target.value)} onKeyDown={tasti}
            placeholder={disabilitata ? "Rispondi da Cursor" : segnaposto} aria-label={segnaposto} />
        </div>
        <div className="azioni">
          <Aggiungi account={account} disabilitata={disabilitata} aperto={menu} onApri={() => setMenu(true)} onChiudi={() => setMenu(false)} allega={() => void allega()} comando={comando} />
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
        {trascina && !disabilitata && <div className="zona-rilascio"><Icona nome="graffetta" colore="accento" /><span>Rilascia per allegare</span></div>}
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
