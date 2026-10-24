// figma: 101-36010 — caricamento del registro (sagome) e 101-36225 — registro non leggibile: uguali in Casella, Decisioni e Regole (#1044).
import { useEffect } from "react";
import caricamento from "../../../design/figma/101-36010.json";
import { avvisa } from "../base/Avvisi";
import { messaggioErrore } from "../base/dati";
import { Bottone } from "../base/Bottone";
import type { useRegistro } from "./dati";
import { AvvisoRosso } from "./Pezzi";

const RIPROVA_MS = 10_000; // «Riprovo tra 10 s.» del frame 101-36225

type Stato = ReturnType<typeof useRegistro>;
/** Mentre il registro carica o non si legge una vista non deve dire «vuoto»: `carica` → sagome, `errore` → avviso rosso con Riprova. */
export const inAttesa = (s: Stato): "carica" | "errore" | null =>
  s.stato === "carica" && !s.dati ? "carica" : s.stato === "errore" || !s.dati || s.dati.errori.length ? "errore" : null;

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

export function AttesaRegistro({ s }: { s: Stato }) {
  const rotto = inAttesa(s) === "errore";
  // con il registro rotto si rilegge ogni 10 secondi
  useEffect(() => { if (!rotto) return; const t = setInterval(s.riprova, RIPROVA_MS); return () => clearInterval(t); }, [rotto]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rotto) return <Sagome />;
  return (
    <>
      <AvvisoRosso titolo="Registro non leggibile" corpo="clotch AI non riesce a leggere il registro. Nuovo tentativo tra 10 s." />
      <div className="riga-f">
        <Bottone tipo="secondario" onClick={s.riprova}>Riprova ora</Bottone>
        {/* shortcut: il percorso è quello di serie; con FRIDAY_REGISTRO diverso (solo prove) apre comunque ~/.claude/registro */}
        <Bottone tipo="secondario" onClick={() => window.impostazioni.apri("~/.claude/registro").catch((e) => avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }))}>Apri il registro</Bottone>
      </div>
    </>
  );
}
