// figma: 101-40699 — dialogo «Modifica regola». Stati che il disegno non ha (#1050): scartare la bozza, rimuovere la regola, motivo di «Salva» spento.
import { useState } from "react";
import { Bottone } from "../base/Bottone";
import { Dialogo } from "../base/Dialogo";
import { file, repo, salva, togli, type Regola } from "./comandiRegola";

export function ModificaRegola({ regola, nuovo, onChiudi }: { regola: Regola; nuovo?: string; onChiudi(): void }) {
  const [testo, setTesto] = useState(nuovo ?? regola.testo);
  const [fase, setFase] = useState<"scrivi" | "scarta" | "rimuovi">("scrivi");
  const [toccato, setToccato] = useState(false);
  const pulito = testo.trim();
  const ok = !!pulito && pulito !== regola.testo;
  const salvaEChiudi = () => { onChiudi(); salva(regola, pulito); };
  const torna = () => setFase("scrivi");
  if (fase === "scarta") {
    return (
      <Dialogo titolo="Scartare le modifiche?" corpo="Il testo scritto va perso." onChiudi={torna}
        bottoni={<><Bottone tipo="secondario" onClick={torna}>Continua a scrivere</Bottone><Bottone tipo="pericolo" onClick={onChiudi}>Scarta</Bottone></>} />
    );
  }
  if (fase === "rimuovi") {
    return (
      <Dialogo titolo="Rimuovere la regola?" corpo={`La regola esce da ${file(regola.dove)}: si apre una PR in ${repo(regola.dove)}.`} onChiudi={torna}
        bottoni={<><Bottone tipo="secondario" onClick={torna}>Annulla</Bottone><Bottone tipo="pericolo" onClick={() => { onChiudi(); togli(regola); }}>Rimuovi</Bottone></>} />
    );
  }
  const nota = !pulito ? "Il testo è vuoto" : toccato && !ok ? "Nessuna modifica" : null; // 167-95889, 167-96188
  return (
    <Dialogo titolo="Modifica regola" onChiudi={() => (testo === regola.testo ? onChiudi() : setFase("scarta"))}
      bottoni={<>
        <Bottone tipo="pericolo" className="rimuovi-regola" onClick={() => setFase("rimuovi")}>Rimuovi</Bottone>
        <Bottone tipo="secondario" onClick={() => (testo === regola.testo ? onChiudi() : setFase("scarta"))}>Annulla</Bottone>
        <Bottone disabled={!ok} onClick={salvaEChiudi}>Salva</Bottone>
      </>}>
      <textarea className="testo-regola t-base" value={testo} onChange={(e) => { setTesto(e.target.value); setToccato(true); }} aria-label="Testo della regola" aria-invalid={!pulito || undefined}
        onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey && ok) { e.preventDefault(); salvaEChiudi(); } }} />
      {nota && <span className={`t-sm ${pulito ? "secondario" : "t-errore"}`} role="status">{nota}</span>}
      <span className="t-sm secondario">{file(regola.dove)} apre una PR in {repo(regola.dove)}</span>
    </Dialogo>
  );
}
