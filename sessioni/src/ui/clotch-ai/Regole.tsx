// figma: 101-40473 — «vista Regole»: regole imparate da clotch AI per repo, con Modifica. Stati: modifica 101-40699,
// salvataggio 101-40936, salvata 101-41166, errore 101-41397, vuoto 101-41628.
import { useState } from "react";
import type { Registro } from "../../clotch-ai";
import { aggiornaAvviso, avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { Dialogo } from "../base/Dialogo";
import { useNavigazione } from "../base/navigazione";
import { clotchAi, useRegistro } from "./dati";
import { giorno } from "./formato";
import { Vuoto } from "./Pezzi";
import { regolePerDove } from "./vista";

type Regola = Registro["regole"][number];

// dove vivono le regole (contratto v1, comando `regola`): generali in claude-config, di progetto nel repo
const GENERALI = "claude-config";
const repo = (dove: string) => (dove === GENERALI ? GENERALI : dove.split("/").filter(Boolean).pop() ?? dove);
const file = (dove: string) => (dove === GENERALI ? "global/hooks/friday/regole-imparate.md" : ".claude/friday-regole.md"); // nome del protocollo del motore
const titolo = (dove: string) => (dove === GENERALI ? `Generali: ${GENERALI}` : `Progetto: ${repo(dove)}`);

/** Modifica = aggiunta della nuova e poi `togli` della vecchia (contratto): se qualcosa va storto la vecchia resta. */
export const avvisoSalvataggio = (dove: string) => avvisa({ tipo: "caricamento", messaggio: `Aprendo la PR in ${repo(dove)}…` });

/** Esito del salvataggio: `pr` della PR aperta da clotch AI, o il perché del no (`riprova` rifà tutto). */
export function esitoSalvataggio(id: number, e: { esito: string; testo: string; pr?: number }, riprova: () => void) {
  if (e.esito === "ok") {
    // shortcut: «Apri» della PR manca finché il registro non dà l'indirizzo della PR (solo il numero, `pr`)
    aggiornaAvviso(id, { tipo: "successo", messaggio: e.pr ? `Regola salvata. PR #${e.pr} aperta.` : "Regola salvata." });
  } else {
    aggiornaAvviso(id, { tipo: "errore", messaggio: e.testo || "Regola non salvata: la PR non si apre.", azione: { etichetta: "Riprova", fai: riprova } });
  }
}

async function salva(vecchia: Regola, testo: string) {
  const id = avvisoSalvataggio(vecchia.dove);
  const e = await clotchAi().comando("regola", { testo, perche: vecchia.perche, dove: vecchia.dove, togli: false });
  const via = e.esito === "ok" ? await clotchAi().comando("regola", { testo: vecchia.testo, dove: vecchia.dove, togli: true }) : null;
  esitoSalvataggio(id, via && via.esito !== "ok" ? via : e, () => salva(vecchia, testo));
}

function Modifica({ regola, nuovo, onChiudi }: { regola: Regola; nuovo?: string; onChiudi(): void }) {
  const [testo, setTesto] = useState(nuovo ?? regola.testo);
  const ok = testo.trim() && testo.trim() !== regola.testo;
  const salvaEChiudi = () => { onChiudi(); salva(regola, testo.trim()); };
  return (
    <Dialogo titolo="Modifica regola" onChiudi={onChiudi}
      bottoni={<>
        <Bottone tipo="secondario" onClick={onChiudi}>Annulla</Bottone>
        <Bottone disabled={!ok} onClick={salvaEChiudi}>Salva</Bottone>
      </>}>
      <textarea className="testo-regola t-base" value={testo} onChange={(e) => setTesto(e.target.value)} aria-label="Testo della regola"
        onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey && ok) { e.preventDefault(); salvaEChiudi(); } }} />
      <span className="t-sm secondario">{file(regola.dove)}, apre una PR in {repo(regola.dove)}</span>
    </Dialogo>
  );
}

export function Regole() {
  const { dati: r } = useRegistro();
  const n = useNavigazione();
  // scena di prova 101-40699: sezione «modifica:<indice>|<testo nuovo>» apre il dialogo già scritto
  const scena = n.sezione?.match(/^modifica:(\d+)\|(.*)$/s);
  const [modifica, setModifica] = useState<{ i: number; nuovo?: string } | null>(scena ? { i: +scena[1], nuovo: scena[2] } : null);
  const gruppi = r ? regolePerDove(r) : [];
  const tutte = gruppi.flatMap((g) => g.regole);
  if (r && !gruppi.length) {
    return <div className="vista-clotch-ai"><Vuoto icona="scudo" titolo="Nessuna regola imparata" corpo="Ogni correzione a clotch AI diventa una regola e compare qui." /></div>;
  }
  return (
    <div className="vista-clotch-ai">
      <span className="t-sm secondario">Poche regole, ognuna dove nasce l’errore. Una modifica apre una PR nel repo giusto.</span>
      {gruppi.map((g) => (
        <section key={g.dove} className="gruppo-f">
          <div className="titolo-gruppo t-xs medio secondario">{titolo(g.dove)}</div>
          {g.regole.map((x) => (
            <div key={x.testo} className="voce-f">
              <div className="testi">
                <span className="t-sm">{x.testo}</span>
                <span className="t-xs secondario">{[file(x.dove), x.t !== null ? giorno(x.t) : ""].filter(Boolean).join(", ")}</span>
              </div>
              <Bottone tipo="secondario" onClick={() => setModifica({ i: tutte.indexOf(x) })}>Modifica</Bottone>
            </div>
          ))}
        </section>
      ))}
      {modifica && tutte[modifica.i] && <Modifica regola={tutte[modifica.i]} nuovo={modifica.nuovo} onChiudi={() => setModifica(null)} />}
    </div>
  );
}
