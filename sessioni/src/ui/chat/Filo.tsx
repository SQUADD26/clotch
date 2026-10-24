// figma: 101-8036 — «Filo» della sessione aperta: messaggi di Roberto, turni coi loro blocchi, «Carica precedenti» (101:9628),
// fine turno (101:15335), richieste vive di clotch AI (101:13650, 13896, 14132) e avvisi in fondo (101:15790, 15993, 16211).
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ChatClotchAi } from "../../clotch-ai";
import { Bottone } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { numero } from "../base/token";
import { nomeModello } from "./Casella";
import { AllegatiMessaggio, VisoreContesto } from "./Allegati";
import { Attivita, Aiutanti, AvvisoFilo, FineTurno, Interrotta, Riassunto, RigaEvento } from "./Lavoro";
import { FileToccati, MessaggioRoberto, Modifica, Pensiero, RicercaWeb, Strumento } from "./Blocchi";
import { Risposta } from "./Risposta";
import { MenuSelezione } from "./Selezione";
import { giorniDelFilo } from "./eventi";
import { riepilogo, type Blocco, type Voce } from "./modello";
import { Domanda, Esito, Permesso, Piano, passiPiano } from "./Richieste";
import { chiaveImmagine, galleria as galleriaDi } from "./percorsi";
import { provaDi, quanti } from "./testi";
import { Visore } from "./Visore";
import "./nuovi.css";

type Richiesta = ChatClotchAi["richieste"][number];

/** Un blocco del turno. `vivo`: l'ultimo turno di una sessione che lavora (le modifiche si vedono aperte, 101:14631). */
function BloccoTurno({ b, chat, vivo, richiesta, da, prova, modello, aperto }: {
  b: Blocco; chat: string; vivo: boolean; richiesta(g: string): Richiesta | null; da: string | null; prova: boolean; modello: string | null; aperto: boolean;
}) {
  switch (b.tipo) {
    case "pensiero": return <Pensiero b={b} aperto={aperto} />;
    case "strumento": return <Strumento b={b} aperta={aperto} />;
    case "modifica": return <Modifica b={b} aperta={vivo} />;
    case "web": return <RicercaWeb b={b} />;
    case "attivita": return <Attivita passi={b.passi} />;
    case "aiutanti": return <Aiutanti aiutanti={b.aiutanti} modello={modello} />;
    case "file-toccati": return <FileToccati b={b} aperto={aperto} />;
    case "risposta": return <Risposta testo={b.testo} inScrittura={b.inScrittura} sessione={chat} prova={prova} />;
    case "interrotta": return <Interrotta />;
    case "errore":
      if (b.riprova) return <AvvisoFilo tipo="attesa" titolo="Riprovo" corpo={`Tentativo ${b.riprova.n} di ${b.riprova.di}`} />;
      return /^API Error/.test(b.testo) ? <AvvisoFilo tipo="errore" titolo="Richiesta non riuscita" corpo={b.testo} /> : <AvvisoFilo tipo="errore" titolo={b.testo} />;
    case "bloccato": return <AvvisoFilo tipo="attesa" titolo="Bloccato da una regola" corpo={b.testo} />;
    case "domanda":
      if (!b.aperta) return b.risposta ? <Esito icona="persona" colore="secondaria" esito="Hai risposto" dettaglio={b.risposta} /> : <Esito icona="persona" colore="secondaria" esito="Senza risposta" />;
      return <Domanda chat={chat} rid={richiesta("domanda")?.rid ?? null} domande={b.domande} da={da} />;
    case "piano":
      if (b.approvato) return <Esito icona="spunta" colore="successo" esito="Piano approvato" dettaglio={quanti(passiPiano(b.testo).passi.length, "passo", "passi")} />;
      return b.aperto ? <Piano chat={chat} rid={richiesta("piano")?.rid ?? null} testo={b.testo} /> : <Esito icona="chiudi" colore="errore" esito="Piano rifiutato" />;
  }
}

/** Quante righe ha il filo: la misura di «3 nuovi messaggi». */
const righeDel = (voci: Voce[]) => voci.reduce((n, v) => n + (v.tipo === "turno" ? v.blocchi.length : 1), 0);

const distanze = new Map<string, number>(); // chat -> distanza dal fondo all'ultimo scorrimento

export function Filo({ voci, chat, vivo, finita, c, da, prima, altri, altriCarica, inFondo, inCima, prova = null }: {
  voci: Voce[]; chat: string; vivo: boolean; finita: boolean; c: ChatClotchAi | null; da: string | null;
  /** Messaggi più vecchi non ancora caricati (null = non si sa, ma ci sono). */
  prima: number | null | false; altri(): void; altriCarica: boolean; inFondo?: ReactNode; inCima?: ReactNode;
  /** Stato di una scena di prova (`sezione` della navigazione): «menu-risposta» apre il menu dell'ultima risposta (101:23727),
   *  «aperti:pensiero,strumento» parte coi blocchi di quei tipi aperti, come dopo un clic (101:8309, 8610, 9628);
   *  «nuovi:3» mostra «3 nuovi messaggi» (101:28652); «selezione:x,y» sceglie l'ultima risposta e apre il suo menu (101:28471). */
  prova?: string | null;
}) {
  const filo = useRef<HTMLDivElement>(null);
  // il visore scorre le immagini del filo, dalla più recente (101:28232 «1 di 2»); «visore:<n>» in una scena lo apre sulla n-esima
  const galleria = useMemo(() => galleriaDi(voci, chat), [voci, chat]);
  const [aperta, setAperta] = useState<string | null>(() => { const n = provaDi(prova, "visore"); return n == null ? null : galleria[Number(n) || 0]?.chiave ?? null; });
  const indice = galleria.findIndex((g) => g.chiave === aperta); // per chiave: un'immagine nuova in testa non sposta quella aperta
  const daFondo = useRef(distanze.get(chat) ?? 0); // distanza dal fondo prima di un cambio: 0 = resta attaccato in fondo; tornando alla chat si ritrova il punto di lettura (issue 698)
  const letto = useRef({ righe: righeDel(voci), prima: voci[0]?.chiave }); // com'era il filo all'ultimo disegno
  const [nuovi, setNuovi] = useState(0); // righe arrivate in fondo mentre si leggeva più su
  const inFondoDel = () => daFondo.current <= numero("spazio-6");
  const richiesta = (g: string) => c?.richieste.find((r) => r.genere === g) ?? null;
  // permessi aperti: non stanno nella trascrizione, solo nel registro di clotch AI
  const permessi = c?.richieste.filter((r) => r.genere === "permesso") ?? [];
  const ultimo = voci.length - 1;
  const aperti = provaDi(prova, "aperti")?.split(",") ?? [];
  // il modello degli aiutanti lo sa solo il registro («Sonnet 5.5», 101:14396)
  const modello = nomeModello([...(c?.aiutanti.values() ?? [])].find((x) => x.modello)?.modello ?? null);

  useLayoutEffect(() => { const f = filo.current; if (f) f.scrollTop = f.scrollHeight - f.clientHeight - daFondo.current; }, []);
  useLayoutEffect(() => {
    const f = filo.current, righe = righeDel(voci), prima = voci[0]?.chiave;
    if (!f) return;
    const arrivate = righe - letto.current.righe;
    // in fondo o con righe aggiunte in cima: si tiene la distanza dal fondo. Più su, il punto di lettura non si muove e la pillola conta le righe nuove
    if (prima !== letto.current.prima || inFondoDel()) f.scrollTop = f.scrollHeight - f.clientHeight - daFondo.current;
    else if (arrivate > 0) setNuovi((n) => n + arrivate);
    letto.current = { righe, prima };
  });
  // la casella cresce (un allegato, più righe di testo) e il filo si stringe: chi era in fondo resta in fondo (148:46383)
  useEffect(() => {
    const f = filo.current;
    if (!f) return;
    const o = new ResizeObserver(() => { if (inFondoDel()) f.scrollTop = f.scrollHeight - f.clientHeight - daFondo.current; });
    o.observe(f);
    return () => o.disconnect();
  }, []);
  const scorri = () => {
    const f = filo.current;
    if (!f) return;
    daFondo.current = f.scrollHeight - f.clientHeight - f.scrollTop;
    distanze.set(chat, daFondo.current);
    if (inFondoDel()) setNuovi(0);
    if (f.scrollTop === 0 && prima !== false) altri(); // «Gli altri si caricano quando sali»
  };

  const mostra = Number(provaDi(prova, "nuovi") ?? nuovi);
  const giorni = giorniDelFilo(voci, Date.now());
  return (
    <VisoreContesto.Provider value={{ sessione: chat, apri: (da) => setAperta(chiaveImmagine(da)) }}>
    <div className="filo-area">
    <div className="filo" ref={filo} onScroll={scorri}>
      {inCima}
      {prima !== false && (
        <div className="precedenti">
          {prima != null && <span>{quanti(prima, "messaggio prima di questi", "messaggi prima di questi")}</span>}
          <Bottone tipo="secondario" onClick={altri} disabled={altriCarica}>Carica precedenti</Bottone>
        </div>
      )}
      {voci.map((v, k) => {
        const giorno = giorni[k] && <RigaEvento testo={giorni[k]!} />;
        if (v.tipo === "roberto") return (
          <Fragment key={v.chiave}>
            {giorno}
            {(v.immagini?.length || v.percorsi?.length) ? <AllegatiMessaggio immagini={v.immagini ?? []} percorsi={v.percorsi ?? []} /> : null}
            {v.testo && <MessaggioRoberto testo={v.testo} />}
          </Fragment>
        );
        if (v.tipo === "riassunto") return <Riassunto key={v.chiave} />;
        if (v.tipo === "evento") return <Fragment key={v.chiave}>{giorno}<RigaEvento testo={v.testo} /></Fragment>;
        const vivoQui = vivo && k === ultimo;
        const r = riepilogo(v);
        return (
          <Fragment key={v.chiave}>{giorno}
          <div className="turno">
            {v.blocchi.map((b, i) => (
              <BloccoTurno key={b.chiave ?? `${v.chiave}:${i}`} b={b} chat={chat} vivo={vivoQui} richiesta={richiesta} da={da} modello={modello} aperto={aperti.includes(b.tipo)}
                prova={provaDi(prova, "menu-risposta") !== null && k === ultimo && i === v.blocchi.length - 1} />
            ))}
            {k === ultimo && finita && <FineTurno ms={r.durata} strumenti={r.strumenti} file={r.file} aiutanti={r.aiutanti} />}
          </div>
          </Fragment>
        );
      })}
      {permessi.map((p, i) => <Permesso key={p.rid} chat={chat} r={p} da={da} prima={i === 0} />)}
      {inFondo}
    </div>
    {indice >= 0 && <Visore galleria={galleria} indice={indice} onIndice={(i) => setAperta(galleria[i].chiave)} onChiudi={() => setAperta(null)} />}
    {mostra > 0 && (
      <button type="button" className="nuovi-messaggi" onClick={() => filo.current?.scrollTo({ top: filo.current.scrollHeight, behavior: "smooth" })}>
        <Icona nome="giu-freccia" colore="primaria" />
        <span>{quanti(mostra, "nuovo messaggio", "nuovi messaggi")}</span>
      </button>
    )}
    <MenuSelezione filo={filo} prova={provaDi(prova, "selezione")} />
    </div>
    </VisoreContesto.Provider>
  );
}
