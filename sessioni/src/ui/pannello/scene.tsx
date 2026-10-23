// figma: 113-51111 — foglio «Pannello obiettivo · stati» per la prova di parità: testi e stati letti dal json del frame, niente a mano.
import type { ReactElement } from "react";
import foglio from "../../../design/figma/113-51111.json";
import interi from "../../../design/figma/113-51111-testi.json";
import schermo from "../../../design/figma/101-49891.json";
import { Clotch, SchermoOccupato } from "./Pillole";
import { PannelloObiettivo, type DatiPannello, type StatoProva } from "./PannelloObiettivo";

interface Nodo { id: string; nome: string; tipo: string; box: { x: number; y: number; w: number; h: number }; variabili: Record<string, string>; testo?: string }
const nodi = (foglio.nodi as unknown as Nodo[]).map((n) => ({ ...n, testo: (interi as Record<string, string>)[n.id] ?? n.testo }));

// stato della prova dal colore dell'icona, come nelle varianti del componente
const DA_COLORE: Record<string, StatoProva> = {
  "colore/icona/successo": "fatta", "colore/icona/terziaria": "attesa", "colore/icona/accento": "in-corso", "colore/icona/errore": "fallita",
};
const numero = (t = "") => Number(t.replace(/[^0-9]/g, ""));

/** I pannelli del foglio, da sinistra a destra, con la loro etichetta. Esportato per il test. */
export function statiDelFoglio(): { etichetta: string; dati: DatiPannello }[] {
  const pannelli = nodi.filter((n) => n.tipo === "INSTANCE" && n.nome === "pannello obiettivo").sort((a, b) => a.box.x - b.box.x);
  return pannelli.map((p) => {
    const dentro = nodi.filter((n) => n.box.x >= p.box.x && n.box.x < p.box.x + p.box.w);
    const testo = (nome: string) => dentro.filter((n) => n.nome === nome).map((n) => n.testo ?? "");
    // una prova ha la sua icona visibile sulla stessa riga; il colore della forma dice lo stato
    const sullaRiga = (n: Nodo, t: Nodo) => Math.abs(n.box.y - t.box.y) < t.box.h;
    const prove = dentro.filter((n) => n.nome === "testo prova").flatMap((t) => {
      const icona = dentro.find((n) => n.tipo === "INSTANCE" && n.nome.startsWith("icona") && sullaRiga(n, t));
      const forma = icona && dentro.find((n) => n.nome === "forma" && sullaRiga(n, t));
      return forma ? [{ testo: t.testo ?? "", stato: DA_COLORE[forma.variabili["fills[0]"]] }] : [];
    });
    const conteggio = testo("conteggio")[0];
    const etichetta = nodi.find((n) => n.nome === "etichetta" && n.box.x === p.box.x)?.testo ?? "";
    return {
      etichetta,
      dati: {
        // la variante «Vuoto» non ha prove né icone: il suo testo è quello del pannello senza obiettivo
        obiettivo: prove.length ? testo("testo obiettivo")[0] : null,
        prove,
        file: { quanti: numero(conteggio), aggiunte: numero(testo("aggiunte")[0]), tolte: numero(testo("tolte")[0]) },
      },
    };
  });
}

function Foglio() {
  return (
    <div className="foglio-stati">
      {statiDelFoglio().map((s) => (
        <div key={s.etichetta}>
          <div className="t-sm medio secondario">{s.etichetta}</div>
          <PannelloObiettivo dati={s.dati} />
        </div>
      ))}
    </div>
  );
}

/** Scene della prova di parità del pannello: `?parita=<node-id>`. */
export const scene: Record<string, () => ReactElement> = {
  "113-51111": Foglio,
  "101-46496": Clotch,
  "101-49891": () => <SchermoOccupato testo={schermo.nodi.find((n) => n.nome === "testo")?.testo ?? ""} />,
};
