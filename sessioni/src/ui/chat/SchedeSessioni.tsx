// figma: 101-44748 — «clotch AI cita le sessioni»: «scheda sessione» per chi aspetta te, «riferimento sessione» per chi lavora,
// scheda al passaggio sul riferimento (101:44989). Le sessioni citate vengono dal campo `sessioni` della risposta (claude-config#2512).
import { useState } from "react";
import type { ChatClotchAi } from "../../clotch-ai";
import type { Sessione } from "../../tipi";
import { Bottone } from "../base/Bottone";
import { usePreferenze } from "../base/dati";
import { Icona } from "../base/Icona";
import { IconaSessione } from "../base/IconaSessione";
import { useNavigazione } from "../base/navigazione";
import { SegnoStato } from "../base/SegnoStato";
import { comanda, useOra } from "./clotch-ai";
import { useRiserva } from "./riserva";
import { SORGENTE, daQuanto, durata, provaDi } from "./testi";
import "./schede.css";

export interface Citata { s: Sessione; c: ChatClotchAi | null }

/** Riga di stato della scheda, nelle forme dei frame: permesso, domanda, al lavoro coi passi. */
function stato({ s, c }: Citata, ora: number) {
  const r = c?.richieste[0];
  if (r?.genere === "permesso") return `Aspetta un tuo permesso ${daQuanto(s.ultimaAttivita, ora)}`;
  if (r || s.stato === "aspetta") return `Ti ha fatto una domanda ${durata(Math.max(60_000, Math.floor((ora - s.ultimaAttivita) / 60_000) * 60_000))} fa`;
  const passi = c?.passi ?? [];
  // shortcut: il registro non dice da quando lavora; «da 2 ore» del frame torna quando un evento porta l'inizio
  return passi.length ? `Al lavoro · ${passi.filter((p) => p.stato === "completed").length} di ${passi.length} passi` : "Al lavoro";
}

export function SchedaSessione({ x, sospesa = false }: { x: Citata; sospesa?: boolean }) {
  const n = useNavigazione();
  const pref = usePreferenze().dati[x.s.id];
  const ora = useOra();
  const ris = useRiserva();
  const { s, c } = x;
  const r = c?.richieste[0];
  const ultimo = c?.domanda ?? c?.dettaglio;
  const apri = () => n.apri("sessione", s.id);
  return (
    <div className={sospesa ? "scheda-sessione sospesa" : "scheda-sessione"}>
      <div className="testata">
        <IconaSessione icona={pref?.icona} colore={pref?.colore} />
        <span className="titolo">{s.titolo}</span>
        <SegnoStato stato={s.stato} />
      </div>
      <div className="stato"><Icona nome="mano" colore="accento" /><span>{stato(x, ora)}</span></div>
      <div className="dettagli">{[s.progetto, s.ramo, SORGENTE[s.sorgente]].filter(Boolean).join(" · ")}</div>
      {ultimo && <div className="ultimo">Ultimo: «{ris.testo(ultimo)}»</div>}
      <div className="bottoni">
        <Bottone onClick={apri}>Apri sessione</Bottone>
        {r?.genere === "permesso"
          ? <Bottone tipo="secondario" onClick={() => void comanda("rispondi_permesso", { chat: s.id, rid: r.rid, scelta: "consenti" })}>Consenti</Bottone>
          : r || s.stato === "aspetta"
            ? <Bottone tipo="secondario" onClick={apri}>Rispondi</Bottone>
            : <Bottone tipo="secondario" onClick={() => void comanda("ferma_chat", { chat: s.id })}>Ferma</Bottone>}
      </div>
    </div>
  );
}

function Riferimento({ x }: { x: Citata }) {
  const n = useNavigazione();
  const pref = usePreferenze().dati[x.s.id];
  const [sopra, setSopra] = useState(provaDi(n.sezione, "scheda") === x.s.id); // scena di prova 101:44989
  return (
    <span className="con-scheda" onMouseEnter={() => setSopra(true)} onMouseLeave={() => setSopra(false)}>
      <button type="button" className="riferimento-sessione" onClick={() => n.apri("sessione", x.s.id)}>
        <IconaSessione icona={pref?.icona} colore={pref?.colore} />
        <span className="titolo" title={x.s.titolo}>{x.s.titolo}</span>
        <SegnoStato stato={x.s.stato} />
      </button>
      {sopra && <SchedaSessione x={x} sospesa />}
    </span>
  );
}

/** Sotto la risposta di clotch AI: schede per chi aspetta te, riferimenti per le altre. */
export function SessioniCitate({ citate }: { citate: Citata[] }) {
  const aspettano = citate.filter((x) => x.s.stato === "aspetta" || !!x.c?.richieste.length);
  const altre = citate.filter((x) => !aspettano.includes(x));
  const tutteLavorano = altre.every((x) => x.s.stato === "lavora");
  return (
    <>
      {aspettano.length > 0 && <div className="sessioni-citate">{aspettano.map((x) => <SchedaSessione key={x.s.id} x={x} />)}</div>}
      {altre.length > 0 && (
        <div className="testo-con-riferimenti">
          {tutteLavorano && <span className="testo">{altre.length === 1 ? "Un’altra lavora:" : `Altre ${altre.length} lavorano:`}</span>}
          {altre.map((x) => <Riferimento key={x.s.id} x={x} />)}
        </div>
      )}
    </>
  );
}
