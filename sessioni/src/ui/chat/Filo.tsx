// figma: 101-8036 — «Filo» della sessione aperta: messaggi di Roberto, turni coi loro blocchi, «Carica precedenti» (101:9628),
// fine turno (101:15335), richieste vive di Friday (101:13650, 13896, 14132) e avvisi in fondo (101:15790, 15993, 16211).
import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ChatFriday } from "../../friday";
import { Bottone } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { numero } from "../base/token";
import { nomeModello } from "./Casella";
import { Attivita, Aiutanti, AvvisoFilo, FineTurno, Interrotta, Riassunto, RigaEvento } from "./Lavoro";
import { FileToccati, MessaggioRoberto, Modifica, Pensiero, RicercaWeb, Strumento } from "./Blocchi";
import { Risposta } from "./Risposta";
import { MenuSelezione } from "./Selezione";
import { giorniDelFilo } from "./eventi";
import { riepilogo, type Blocco, type Voce } from "./modello";
import { Domanda, Esito, Permesso, Piano, passiPiano } from "./Richieste";
import { provaDi, quanti } from "./testi";
import "./nuovi.css";

type Richiesta = ChatFriday["richieste"][number];

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
    case "errore": return <AvvisoFilo tipo="errore" titolo={b.testo} />;
    case "bloccato": return <AvvisoFilo tipo="attesa" titolo="Bloccato da una regola" corpo={b.testo} />;
    case "domanda":
      if (!b.aperta) return <Esito icona="persona" colore="secondaria" esito="Hai risposto" dettaglio={b.risposta ?? ""} />;
      return <Domanda chat={chat} rid={richiesta("domanda")?.rid ?? null} domande={b.domande} da={da} />;
    case "piano":
      if (b.approvato) return <Esito icona="spunta" colore="successo" esito="Piano approvato" dettaglio={quanti(passiPiano(b.testo).passi.length, "passo", "passi")} />;
      return b.aperto ? <Piano chat={chat} rid={richiesta("piano")?.rid ?? null} testo={b.testo} /> : null;
  }
}

/** Quante righe ha il filo: la misura di «3 nuovi messaggi». */
const righeDel = (voci: Voce[]) => voci.reduce((n, v) => n + (v.tipo === "turno" ? v.blocchi.length : 1), 0);

export function Filo({ voci, chat, vivo, finita, c, da, prima, altri, altriCarica, inFondo, prova = null }: {
  voci: Voce[]; chat: string; vivo: boolean; finita: boolean; c: ChatFriday | null; da: string | null;
  /** Messaggi più vecchi non ancora caricati (null = non si sa, ma ci sono). */
  prima: number | null | false; altri(): void; altriCarica: boolean; inFondo?: ReactNode;
  /** Stato di una scena di prova (`sezione` della navigazione): «menu-risposta» apre il menu dell'ultima risposta (101:23727),
   *  «aperti:pensiero,strumento» parte coi blocchi di quei tipi aperti, come dopo un clic (101:8309, 8610, 9628);
   *  «nuovi:3» mostra «3 nuovi messaggi» (101:28652); «selezione:x,y» sceglie l'ultima risposta e apre il suo menu (101:28471). */
  prova?: string | null;
}) {
  const filo = useRef<HTMLDivElement>(null);
  const daFondo = useRef(0); // distanza dal fondo prima di un cambio: 0 = resta attaccato in fondo
  const letto = useRef({ righe: righeDel(voci), prima: voci[0]?.chiave }); // com'era il filo all'ultimo disegno
  const [nuovi, setNuovi] = useState(0); // righe arrivate in fondo mentre si leggeva più su
  const inFondoDel = () => daFondo.current <= numero("spazio-6");
  const richiesta = (g: string) => c?.richieste.find((r) => r.genere === g) ?? null;
  // permessi aperti: non stanno nella trascrizione, solo nel registro di Friday
  const permessi = c?.richieste.filter((r) => r.genere === "permesso") ?? [];
  const ultimo = voci.length - 1;
  const aperti = provaDi(prova, "aperti")?.split(",") ?? [];
  // il modello degli aiutanti lo sa solo il registro («Sonnet 5.5», 101:14396)
  const modello = nomeModello([...(c?.aiutanti.values() ?? [])].find((x) => x.modello)?.modello ?? null);

  useLayoutEffect(() => {
    const f = filo.current, righe = righeDel(voci), prima = voci[0]?.chiave;
    if (!f) return;
    const arrivate = righe - letto.current.righe;
    // in fondo o con righe aggiunte in cima: si tiene la distanza dal fondo. Più su, il punto di lettura non si muove e la pillola conta le righe nuove
    if (prima !== letto.current.prima || inFondoDel()) f.scrollTop = f.scrollHeight - f.clientHeight - daFondo.current;
    else if (arrivate > 0) setNuovi((n) => n + arrivate);
    letto.current = { righe, prima };
  });
  const scorri = () => {
    const f = filo.current;
    if (!f) return;
    daFondo.current = f.scrollHeight - f.clientHeight - f.scrollTop;
    if (inFondoDel()) setNuovi(0);
    if (f.scrollTop === 0 && prima !== false) altri(); // «Gli altri si caricano quando sali»
  };

  const mostra = Number(provaDi(prova, "nuovi") ?? nuovi);
  const giorni = giorniDelFilo(voci, Date.now());
  return (
    <div className="filo-area">
    <div className="filo" ref={filo} onScroll={scorri}>
      {prima !== false && (
        <div className="precedenti">
          {prima != null && <span>{quanti(prima, "messaggio prima di questi", "messaggi prima di questi")}</span>}
          <Bottone tipo="secondario" onClick={altri} disabled={altriCarica}>Carica precedenti</Bottone>
        </div>
      )}
      {voci.map((v, k) => {
        const giorno = giorni[k] && <RigaEvento testo={giorni[k]!} />;
        if (v.tipo === "roberto") return <Fragment key={v.chiave}>{giorno}<MessaggioRoberto testo={v.testo} /></Fragment>;
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
      {permessi.map((p) => <Permesso key={p.rid} chat={chat} r={p} da={da} />)}
      {inFondo}
    </div>
    {mostra > 0 && (
      <button type="button" className="nuovi-messaggi" onClick={() => filo.current?.scrollTo({ top: filo.current.scrollHeight, behavior: "smooth" })}>
        <Icona nome="giu-freccia" colore="primaria" />
        <span>{quanti(mostra, "nuovo messaggio", "nuovi messaggi")}</span>
      </button>
    )}
    <MenuSelezione filo={filo} prova={provaDi(prova, "selezione")} />
    </div>
  );
}
