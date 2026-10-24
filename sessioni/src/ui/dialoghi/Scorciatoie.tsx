// figma: 101-22186 — «Dialogo: scorciatoie da tastiera»: titolo con chiudi, ricerca, due colonne di gruppi con i tasti.
import { useState } from "react";
import { Dialogo } from "../base/Dialogo";
import { Campo } from "../base/Campo";
import { chiudiDialogo } from "../base/dialoghi";
import { useImpostazioni } from "../impostazioni/stato";
import { filtra } from "./elenco";

export function DialogoScorciatoie() {
  const [q, setQ] = useState("");
  const { scorciatoie } = useImpostazioni();
  const gruppi = filtra(scorciatoie, q);
  return (
    <Dialogo titolo="Scorciatoie da tastiera" largo alto chiudi onChiudi={chiudiDialogo}>
      <Campo grande tasto="esc" placeholder="Cerca scorciatoie" value={q} autoFocus onChange={(e) => setQ(e.target.value)} />
      {gruppi.length ? (
        <div className="colonne-tasti">
          {[0, 1].map((c) => (
            <div key={c} className="colonna-tasti">
              {gruppi.filter((g) => g.colonna === c).map((g) => (
                <section key={g.titolo} className="gruppo-tasti">
                  <div className="t-xs secondario">{g.titolo}</div>
                  {g.righe.map((r) => (
                    <div key={r.etichetta} className="riga-tasto">
                      <span className="t-sm azione">{r.etichetta}</span>
                      {r.tasti ? <span className="tasto-chip">{r.tasti}</span> : <span className="t-sm secondario">Non assegnata</span>}
                    </div>
                  ))}
                </section>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="nessuna">
          <div className="t-base medio">Nessun risultato</div>
          <div className="t-sm secondario">Prova con altre parole.</div>
        </div>
      )}
    </Dialogo>
  );
}
