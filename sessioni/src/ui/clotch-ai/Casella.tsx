// figma: 148-63870 — «Fatto oggi» aperto (a zero: 148-63992) nella «vista Casella» 101-35494: obiettivi e chat in attesa per progetto. Stati: vuota 101-35803, caricamento 101-36010,
// registro non leggibile 101-36225, obiettivo proposto 101-47170 (con Clotch) e 101-47297 (senza).
import { useEffect, useState } from "react";
import type { Registro } from "../../clotch-ai";
import { acceso as clotchAcceso } from "../pannello/clotch";
import caricamento from "../../../design/figma/101-36010.json";
import { avvisa } from "../base/Avvisi";
import { messaggioErrore } from "../base/dati";
import { Bottone } from "../base/Bottone";
import { Icona, type NomeIcona } from "../base/Icona";
import { useNavigazione } from "../base/navigazione";
import { useImpostazioni } from "../impostazioni/stato";
import { clotchAi, useRegistro } from "./dati";
import { AvvisoRosso, Vuoto } from "./Pezzi";
import { casella, type Progetto } from "./vista";

const RIPROVA_MS = 10_000; // «Riprovo tra 10 s.» del frame 101-36225
const PASSO: Record<string, [NomeIcona, "successo" | "accento" | "secondaria"]> = {
  completed: ["spunta", "successo"], in_progress: ["in-corso", "accento"], pending: ["orologio", "secondaria"],
};

/** Le sessioni di `progetto` finite oggi: la stessa regola di `fattoOggi` in vista.ts, ma coi titoli. */
const fatteOggi = (r: Registro, progetto: string) => [...r.chat.values()]
  .filter((c) => c.progetto === progetto && c.stato === "finito" && c.visto !== null && new Date(c.visto).toDateString() === new Date().toDateString())
  .map((c) => c.titolo ?? c.chat);

function SchedaProgetto({ p, fatte }: { p: Progetto; fatte: string[] }) {
  const n = useNavigazione();
  const [aperto, setAperto] = useState(n.sezione === `fatto:${p.nome}`); // scena 148-63870: «Fatto oggi» già aperto
  const dettaglio = p.aspettano.length ? (p.aspettano.length === 1 ? "1 aspetta te" : `${p.aspettano.length} aspettano te`) : "al lavoro";
  const o = p.obiettivo;
  // nel disegno (101-35494) i passi si vedono solo per il progetto la cui sessione madre è al lavoro
  return (
    <section className="scheda">
      <div className="riga-f">
        <Icona nome="cartella" />
        <span className="riempi t-base medio">{p.nome}</span>
        <span className={`t-sm ${p.aspettano.length ? "" : "secondario"}`}>{dettaglio}</span>
      </div>
      {o && (
        <div className="colonna-f gap-2">
          <div className="riga-f">
            <Icona nome="obiettivo" />
            <span className="riempi t-sm">{o.testo}</span>
            <span className="t-sm secondario">{o.fatti} di {o.passi.length} passi</span>
          </div>
          <div className="barra-uso"><div style={{ width: `${o.passi.length ? (o.fatti / o.passi.length) * 100 : 0}%` }} /></div>
        </div>
      )}
      {o?.lavora && o.passi.length > 0 && (
        <div className="colonna-f gap-1">
          {o.passi.map((x, i) => {
            const [icona, colore] = PASSO[x.stato] ?? PASSO.pending;
            return (
              <div key={i} className="riga-f">
                <Icona nome={icona} colore={colore} gira={false} />
                <span className={`riempi t-sm ${x.stato === "in_progress" ? "medio" : "secondario"}`}>{x.testo}</span>
              </div>
            );
          })}
        </div>
      )}
      {p.aspettano.length > 0 && (
        <div className="colonna-f gap-1">
          <span className="t-xs medio secondario">Aspettano te</span>
          {p.aspettano.map((a) => (
            <div key={a.chat} className="riga-f attesa">
              <Icona nome="mano" colore="accento" />
              <span className="riempi t-sm">{a.titolo}</span>
              <span className="t-sm secondario">{a.genere}</span>
              <Bottone tipo="secondario" onClick={() => n.apri("sessione", a.chat)}>Apri</Bottone>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="riga-f" aria-expanded={aperto} disabled={!fatte.length} onClick={() => setAperto(!aperto)}>
        <Icona nome={aperto ? "giu" : "destra"} />
        <span className="t-sm secondario">Fatto oggi: {fatte.length}</span>
      </button>
      {aperto && fatte.length > 0 && (
        <div className="colonna-f gap-1">
          {fatte.map((t, i) => (
            <div key={i} className="riga-f">
              <Icona nome="spunta" colore="successo" gira={false} />
              <span className="riempi t-sm secondario">{t}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ObiettivoProposto({ o, clotch }: { o: ReturnType<typeof casella>["proposti"][number]; clotch: boolean }) {
  // fatto: la scheda sparisce col registro nuovo; non riuscito: il perché di clotch AI (testo del disegno se non ne dà)
  const decidi = async (esito: "accetta" | "rifiuta") => {
    const e = await clotchAi().comando("obiettivo", { chat: o.chat, esito });
    if (e.esito !== "ok") avvisa({ tipo: "errore", messaggio: e.testo || "clotch AI non risponde" });
  };
  return (
    <section className="scheda proposta">
      <div className="riga-f">
        <Icona nome="obiettivo" colore="accento" />
        <span className="riempi t-base medio">Obiettivo proposto · {o.progetto}</span>
      </div>
      <span className="t-sm secondario">{o.testo}</span>
      <div className="riga-f">
        <Bottone onClick={() => decidi("accetta")}>Accetta</Bottone>
        <Bottone tipo="secondario" onClick={() => decidi("rifiuta")}>Rifiuta</Bottone>
        {clotch && (
          <span className="riga-f nota-clotch"><Icona nome="schermo" /><span className="t-xs secondario">Puoi decidere anche dal notch</span></span>
        )}
      </div>
    </section>
  );
}

// Sagome lette dal frame 101-36010: tre schede con quattro barre, larghezze in proporzione alla colonna.
type Nodo = { nome: string; box: { x: number; y: number; w: number } };
const nodi = caricamento.nodi as unknown as Nodo[];
const colonna = nodi.find((x) => x.nome === "vista Casella")!.box.w;
const prima = nodi.find((x) => x.nome === "sagoma progetto")!.box;
const barre = nodi.filter((x) => x.nome === "barra" && x.box.y < prima.y + 132 && x.box.y > prima.y).map((x) => (x.box.w / colonna) * 100);

function Sagome() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="scheda" aria-busy="true">
          {barre.map((w, j) => <div key={j} className="sagoma-f" style={{ width: `${w}%` }} />)}
        </div>
      ))}
    </>
  );
}

export function Casella() {
  const n = useNavigazione();
  const s = useRegistro();
  const obiettiviNotch = useImpostazioni().clotchObiettivi;
  const rotto = s.stato === "errore" || (!!s.dati && s.dati.errori.length > 0);
  // «Riprovo tra 10 s.» (101-36225): con il registro rotto si rilegge ogni 10 secondi
  useEffect(() => { if (!rotto) return; const t = setInterval(s.riprova, RIPROVA_MS); return () => clearInterval(t); }, [rotto]); // eslint-disable-line react-hooks/exhaustive-deps
  if (s.stato === "carica" && !s.dati) return <div className="vista-clotch-ai"><Sagome /></div>;
  if (rotto || !s.dati) {
    return (
      <div className="vista-clotch-ai">
        <AvvisoRosso titolo="Registro non leggibile" corpo="clotch AI non riesce a leggere ~/.claude/registro/AAAA-MM.jsonl. Riprovo tra 10 s." />
        <div className="riga-f">
          <Bottone tipo="secondario" onClick={s.riprova}>Riprova ora</Bottone>
          {/* shortcut: il percorso è quello di serie; con FRIDAY_REGISTRO diverso (solo prove) apre comunque ~/.claude/registro */}
          <Bottone tipo="secondario" onClick={() => window.impostazioni.apri("~/.claude/registro").catch((e) => avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }))}>Apri il registro</Bottone>
        </div>
      </div>
    );
  }
  const c = casella(s.dati as Registro, Date.now());
  if (!c.progetti.length && !c.proposti.length) {
    return (
      <div className="vista-clotch-ai">
        <Vuoto icona="posta" titolo="Niente aspetta te" corpo="clotch AI ti avvisa qui, in chat o a voce, quando una sessione ha bisogno di te.">
          <Bottone tipo="secondario" onClick={() => n.apri("clotch-ai")}>Scrivi a clotch AI</Bottone>
        </Vuoto>
      </div>
    );
  }
  return (
    <div className="vista-clotch-ai">
      {c.proposti.map((o) => <ObiettivoProposto key={o.chat} o={o} clotch={obiettiviNotch && clotchAcceso(s.dati!, Date.now())} />)}
      {c.progetti.map((p) => <SchedaProgetto key={p.nome} p={p} fatte={fatteOggi(s.dati as Registro, p.nome)} />)}
    </div>
  );
}
