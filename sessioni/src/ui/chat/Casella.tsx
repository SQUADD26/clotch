// figma: 101-43332 — «Casella di scrittura» 101:7407 (Vuota, Scritta, Fuoco, In corso, Disabilitata), «Messaggio in coda» 101:13488,
// coda (101:14849), modifica della voce (101:43708), «invia ora» (101:43945), Invio diretto (101:43535).
// Scelte e menu (#437): comandi «/» 101:26745, file «@» 101:27018, permessi e contesto 101:26140, modello e sforzo 101:26427, non inviato 101:27528.
// Mentre la sessione lavora: ↵ interrompe e manda subito (`manda` modo subito), ⌘↵ mette in coda (`manda` modo coda).
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { avvisa } from "../base/Avvisi";
import { BottoneIcona, Bottone } from "../base/Bottone";
import { usePreferenze } from "../base/dati";
import { Icona } from "../base/Icona";
import { registraAzione } from "../base/scorciatoie";
import { useImpostazioni } from "../impostazioni/stato";
import { azioneDi, tastiDi } from "../impostazioni/tasti";
import { Aggiungi } from "./Aggiungi";
import { ALLEGATI_PROVA, ChipAllegato, type AllegatoCasella } from "./Allegati";
import { ChipContesto, ChipModello, ChipPermessi, impostaDi } from "./Chip";
import { useAvvisiSopra } from "./avvisiSopra";
import { comanda, comandaEsito } from "./clotch-ai";
import { Suggerimenti, useVoci } from "./Suggerimenti";
import { cercaDi, conScelta } from "./cerca-casella";
import { casella, conPercorsi, eImmagine, nomeFile, statoAllegato } from "./percorsi";
import { etichettaModello, motivoNonInviato } from "./scelte";
import { useBozza } from "./bozze";
import { argsManda, provaDi, quanti } from "./testi";
import "./casella.css";

export interface VoceCoda { voce: string; testo: string }

export { nomeModello } from "./scelte";

const Tasto = ({ t }: { t: string }) => <span className="tasto">{t}</span>;

function Coda({ voci, modifica, onModifica, chat, suggerimento, attuale, preferenza }: {
  voci: VoceCoda[]; modifica: string | null; onModifica(v: VoceCoda): void; chat: string; suggerimento: boolean; attuale: string | null; preferenza: string;
}) {
  const subito = async (v: VoceCoda) => { if (await comanda("manda", argsManda(chat, v.testo, "subito", preferenza, attuale))) await comanda("coda_togli", { chat, voce: v.voce }); };
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
 *  «menu-aggiungi» (101:25845), «rilascio» (101:27294), «menu:permessi» / «menu:modello» (101:26140, 101:26427), «tooltip» del contesto (101:26140), «errore:<perché>» (101:27528).
 *  `account`: la cartella dell'account della sessione, per le sue skill. */
export function Casella({ chat, lavora, coda, modello, permessi = null, contesto = null, disabilitata, segnaposto = "Scrivi alla sessione", prova = null, appenaMandato = false, account = "" }: {
  chat: string; lavora: boolean; coda: VoceCoda[]; modello: string | null; permessi?: string | null; contesto?: number | null; disabilitata: boolean; segnaposto?: string; prova?: string | null; account?: string;
  /** Roberto ha appena interrotto e mandato (101:43535): i tasti restano sotto la casella. */
  appenaMandato?: boolean;
}) {
  const inModifica = provaDi(prova, "modifica") !== null ? coda[0] ?? null : null;
  const { testo, modifica, invio, bozza } = useBozza(chat, provaDi(prova, "scritta") ?? inModifica?.testo ?? "", inModifica);
  const area = useRef<HTMLTextAreaElement>(null);
  const areaCasella = useRef<HTMLDivElement>(null);
  useAvvisiSopra(areaCasella);
  const { scorciatoie, modello: globale } = useImpostazioni();
  const pref = usePreferenze().dati[chat], imposta = useMemo(() => impostaDi(chat), [chat]);
  const preferenza = etichettaModello(pref?.modello) ?? globale; // la scelta di questa chat vince su quella dell'app
  const dati = { s: { modello, permessi, contesto }, p: pref };
  const [allegati, setAllegati] = useState<AllegatoCasella[]>(() => (provaDi(prova, "allegati") !== null ? ALLEGATI_PROVA : []));
  const [menuAggiungi, setMenuAggiungi] = useState(() => provaDi(prova, "menu-aggiungi") !== null);
  const [trascina, setTrascina] = useState(() => provaDi(prova, "rilascio") !== null);
  const unisci = (nuovi: AllegatoCasella[]) => setAllegati((x) => [...x, ...nuovi.filter((n, i) => !x.some((y) => y.percorso === n.percorso) && nuovi.findIndex((m) => m.percorso === n.percorso) === i)]);
  const caricando = allegati.some((a) => a.carico); // il messaggio parte quando tutti i file sono letti
  const allega = async () => unisci(await casella().scegli().catch(() => []));
  /** «/goal », «/plan », «/<skill> »: il comando va in testa al messaggio, al posto di un altro già scritto. */
  const comando = (c: string) => { bozza.scrivi(c + testo.replace(/^\/\S*\s*/, "")); area.current?.focus(); };
  const [menu, setMenu] = useState<"permessi" | "modello" | null>(() => { const m = provaDi(prova, "menu"); return m === "permessi" || m === "modello" ? m : null; });
  const [errore, setErrore] = useState<string | null>(provaDi(prova, "errore"));
  const ultimo = useRef<"subito" | "coda">("subito");
  // menu con «/» e «@»: aperto dal testo prima del cursore (a riposo, in fondo); Esc o uscire dalla casella lo chiudono fino al prossimo tasto
  const [caret, setCaret] = useState<number | null>(null), [chiuso, setChiuso] = useState(false), [scelta, setScelta] = useState(0);
  const poi = useRef<number | null>(null);
  const cerca = chiuso || disabilitata ? null : cercaDi(testo, Math.min(caret ?? testo.length, testo.length));
  const voci = useVoci(chat, cerca);

  // scelta fatta in un menu dei chip: il fuoco torna al testo, se è caduto sul fondo della pagina
  const eraAperto = useRef(false);
  useEffect(() => {
    if (menu === null && eraAperto.current && document.activeElement === document.body) area.current?.focus();
    eraAperto.current = menu !== null;
  }, [menu]);

  useEffect(() => (lavora && !disabilitata ? registraAzione("ferma", () => void comanda("interrompi", { chat })) : undefined), [lavora, disabilitata, chat]);

  // la casella cresce col testo (101:25542 «testo lungo»); dopo una scelta del menu il cursore va dopo la voce
  useEffect(() => {
    const a = area.current;
    if (!a) return;
    a.style.height = "auto"; a.style.height = `${a.scrollHeight}px`;
    if (poi.current !== null) { a.setSelectionRange(poi.current, poi.current); poi.current = null; }
  }, [testo]);

  // file trascinati sulla finestra: la zona di rilascio sulla casella; fuori dalla casella non si apre il file al posto dell'app
  const aggiungi = useRef((_: string[]) => {});
  aggiungi.current = async (percorsi) => {
    unisci(percorsi.map((percorso) => ({ percorso, nome: nomeFile(percorso), tipo: eImmagine(percorso) ? "immagine" : "file", byte: null, carico: true })));
    const trovati = percorsi.length ? await casella().descrivi(percorsi).catch(() => []) : [];
    if (trovati.length < percorsi.length) avvisa({ tipo: "errore", messaggio: "File non letto" });
    // il chip «Carico…» diventa il file letto; se non si è letto sparisce
    setAllegati((x) => x.flatMap((a) => (a.carico && percorsi.includes(a.percorso) ? trovati.filter((t) => t.percorso === a.percorso) : [a])));
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

  const scrivi = (t: string, c: number) => { bozza.scrivi(t); setCaret(c); setChiuso(false); setScelta(0); setErrore(null); };
  const scegli = (voce: string) => {
    if (!cerca) return;
    const r = conScelta(testo, cerca, cerca.tipo === "file" ? `@${voce}` : voce); // un file resta citato con «@»
    poi.current = r.caret;
    scrivi(r.testo, r.caret);
    area.current?.focus();
  };

  /** Un comando alla sessione; se non parte, il perché resta sotto la casella (101:27528) e il testo resta dov'è. */
  const invia = async (cmd: Parameters<typeof comandaEsito>[0], args: Record<string, unknown>) => {
    const e = await comandaEsito(cmd, args);
    if (e?.esito === "ok") return true;
    setErrore(motivoNonInviato(e));
    return false;
  };
  const manda = async (modo: "subito" | "coda") => {
    if (caricando) return;
    const richiesta = bozza.inizia();
    if (!richiesta) return;
    ultimo.current = modo; setErrore(null);
    const t = conPercorsi(richiesta.testo.trim(), allegati.filter((a) => !statoAllegato(a)).map((a) => a.percorso)), modifica = richiesta.modifica;
    let ok = false;
    try {
      ok = modifica
        ? modo === "coda"
          ? await invia("coda_modifica", { chat, voce: modifica.voce, testo: t })
          : (await invia("manda", argsManda(chat, t, "subito", preferenza, modello))) && (await invia("coda_togli", { chat, voce: modifica.voce }))
        : await invia("manda", argsManda(chat, t, lavora ? modo : "subito", preferenza, modello));
    } finally { richiesta.finisci(ok); if (ok) setAllegati([]); }
  };

  const tasti = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (voci.length && !e.nativeEvent.isComposing) {
      const su = e.key === "ArrowUp", giu = e.key === "ArrowDown", scelto = voci[Math.min(scelta, voci.length - 1)];
      if (su || giu) { e.preventDefault(); setScelta((scelta + (giu ? 1 : voci.length - 1)) % voci.length); return; }
      if (e.key === "Escape") { e.preventDefault(); setChiuso(true); return; }
      // un comando scritto per intero e Invio: parte, non si riscrive
      const intero = cerca?.tipo === "comando" && testo.trim() === scelto.nome;
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !intero)) { e.preventDefault(); scegli(scelto.nome); return; }
    }
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
    <div className="area-casella con-menu" ref={areaCasella}>
      {cerca && <Suggerimenti tipo={cerca.tipo} voci={voci} scelta={Math.min(scelta, voci.length - 1)} onScelta={setScelta} onScegli={scegli} />}
      {altre.length > 0 && <Coda voci={altre} chat={chat} attuale={modello} preferenza={preferenza} suggerimento={provaDi(prova, "suggerimento") !== null} modifica={modifica?.voce ?? null} onModifica={(v) => { bozza.modifica(v); area.current?.focus(); }} />}
      {modifica && (
        <div className="nota-casella"><Icona nome="matita" /><span>Modifichi il messaggio in coda. ⌘↵ lo rimette in coda.</span></div>
      )}
      <div className={`casella ${stato}${modifica || menu || menuAggiungi ? " fuoco" : ""}${errore ? " errore" : ""}`}>
        {allegati.length > 0 && (
          <div className="allegati-casella">
            {allegati.map((a) => <ChipAllegato key={a.percorso} a={a} onRimuovi={() => setAllegati((x) => x.filter((y) => y !== a))} />)}
          </div>
        )}
        <div className="area-testo">
          <textarea ref={area} rows={1} value={testo} disabled={disabilitata} onChange={(e) => scrivi(e.target.value, e.target.selectionStart)} onKeyDown={tasti}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart)} onFocus={() => setChiuso(false)} onBlur={() => setChiuso(true)}
            placeholder={disabilitata ? "Rispondi da Cursor" : segnaposto} aria-label={segnaposto} />
        </div>
        <div className="azioni">
          <Aggiungi account={account} disabilitata={disabilitata} aperto={menuAggiungi} onApri={() => setMenuAggiungi(true)} onChiudi={() => setMenuAggiungi(false)} allega={() => void allega()} comando={comando} />
          <ChipPermessi {...dati} imposta={imposta} aperto={menu === "permessi"} onAperto={(a) => setMenu(a ? "permessi" : null)} disabled={disabilitata} />
          <span className="spinta" />
          <ChipContesto s={dati.s} visibile={provaDi(prova, "tooltip") !== null} />
          <ChipModello {...dati} imposta={imposta} aperto={menu === "modello"} onAperto={(a) => setMenu(a ? "modello" : null)} disabled={disabilitata} />
          <BottoneIcona icona="microfono" etichetta="Detta" disabled />
          <button type="button" className="bottone-invia" disabled={disabilitata || invio || (!ferma && (caricando || !testo.trim()))}
            aria-label={ferma ? "Interrompi" : "Invia"} title={ferma ? "Interrompi" : "Invia"}
            onClick={() => (ferma ? comanda("interrompi", { chat }) : manda("subito"))}>
            <Icona nome={ferma ? "stop" : "invia"} colore={stato === "vuota" || stato === "disabilitata" ? "terziaria" : "su-accento"} />
          </button>
        </div>
        {trascina && !disabilitata && <div className="zona-rilascio"><Icona nome="graffetta" colore="accento" /><span>Rilascia per allegare</span></div>}
      </div>
      {errore && (
        <div className="errore-invio" role="alert">
          <Icona nome="avviso" colore="errore" /><span className="testo">{errore}</span>
          <Bottone tipo="secondario" disabled={invio} onClick={() => void manda(ultimo.current)}>Riprova</Bottone>
        </div>
      )}
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
