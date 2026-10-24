// figma: 101-40473 — «vista Regole»: regole imparate da clotch AI per repo, con Modifica. Stati: modifica 101-40699,
// salvataggio 101-40936, salvata 101-41166, errore 101-41397, vuoto 101-41628.
import { useEffect, useRef, useState } from "react";
import { avvisa } from "../base/Avvisi";
import { Pezzi } from "../base/Pezzi";
import { Bottone } from "../base/Bottone";
import { useNavigazione } from "../base/navigazione";
import { chiave, file, GENERALI, repo, type Regola } from "./comandiRegola";
import { useRegistro } from "./dati";
import { giorno } from "./formato";
import { useInCorso } from "./inCorso";
import { ModificaRegola } from "./ModificaRegola";
import { Vuoto } from "./Pezzi";
import { AttesaRegistro, inAttesa } from "./StatoRegistro";
import { regolePerDove } from "./vista";

const titolo = (dove: string) => (dove === GENERALI ? `Generali ${GENERALI}` : `Progetto ${repo(dove)}`);

export function Regole() {
  const stato = useRegistro();
  const r = stato.dati;
  const n = useNavigazione();
  const inCorso = useInCorso();
  // scena di prova 101-40699: sezione «modifica:<indice>|<testo nuovo>» apre il dialogo già scritto
  const scena = useRef(n.sezione?.match(/^modifica:(\d+)\|(.*)$/s));
  // la regola aperta si tiene per chiave, non per posizione: l'elenco cambia quando clotch AI ne impara una (#1048)
  const [modifica, setModifica] = useState<{ chiave: string; nuovo?: string } | null>(null);
  const gruppi = r ? regolePerDove(r) : [];
  const tutte = gruppi.flatMap((g) => g.regole);
  const aperta = modifica && tutte.find((x) => chiave(x) === modifica.chiave);
  useEffect(() => {
    const s = scena.current;
    if (s && tutte[+s[1]]) { scena.current = null; setModifica({ chiave: chiave(tutte[+s[1]]), nuovo: s[2] }); }
    else if (modifica && r && !aperta) { setModifica(null); avvisa({ tipo: "info", messaggio: "La regola non c’è più." }); }
  });
  if (inAttesa(stato)) return <div className="vista-clotch-ai"><AttesaRegistro s={stato} /></div>;
  if (r && !gruppi.length) {
    return <div className="vista-clotch-ai"><Vuoto icona="scudo" titolo="Nessuna regola imparata" corpo="Ogni correzione a clotch AI diventa una regola e compare qui." /></div>;
  }
  return (
    <div className="vista-clotch-ai">
      <span className="t-sm secondario">Poche regole, ognuna dove nasce l’errore. Una modifica apre una PR nel repo giusto.</span>
      {gruppi.map((g) => (
        <section key={g.dove} className="gruppo-f">
          <div className="titolo-gruppo t-xs medio secondario">{titolo(g.dove)}</div>
          {g.regole.map((x: Regola) => (
            <div key={x.testo} className="voce-f">
              <div className="testi">
                <span className="t-sm">{x.testo}</span>
                <span className="t-xs secondario"><Pezzi parti={[file(x.dove), x.t !== null ? giorno(x.t) : "Senza data"]} /></span>
              </div>
              <Bottone tipo="secondario" caricamento={inCorso.has(chiave(x))} onClick={() => setModifica({ chiave: chiave(x) })}>Modifica</Bottone>
            </div>
          ))}
        </section>
      ))}
      {aperta && <ModificaRegola regola={aperta} nuovo={modifica.nuovo} onChiudi={() => setModifica(null)} />}
    </div>
  );
}
