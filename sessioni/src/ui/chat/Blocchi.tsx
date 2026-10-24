// figma: 101-8036 — blocchi del filo: «Messaggio Roberto» 101:7210, «Risposta» 101:7216, «Blocco codice» 101:7213,
// «Modifica file» 101:13464, «File toccati» 101:7315.
// Pensiero, chiamate strumento, ricerca sul web e aiutanti: filo compatto (Compatto.tsx, 163-84565).
import { useState, type ReactNode } from "react";
import { avvisa } from "../base/Avvisi";
import { BottoneIcona } from "../base/Bottone";
import { Icona, type NomeIcona } from "../base/Icona";
import type { Blocco } from "./modello";
import { quanti } from "./testi";
import { useRiserva } from "./riserva";
import "./filo.css";
import "./uscita.css";
import { conTransizione } from "../base/movimento";

// un messaggio di più di RIGHE_BOLLA righe o CARATTERI_BOLLA caratteri si vede ridotto, con «Mostra tutto» sotto
const RIGHE_BOLLA = 12, CARATTERI_BOLLA = 800;
const INDIRIZZO = /(https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]])/;

/** Gli indirizzi web scritti da Roberto si aprono come quelli della risposta. */
const conLink = (t: string): ReactNode[] => t.split(INDIRIZZO).map((p, i) => i % 2 ? <a key={i} href={p} title={p} target="_blank" rel="noreferrer noopener">{p}</a> : p);

export function MessaggioRoberto({ testo }: { testo: string }) {
  const r = useRiserva(), t = r.testo(testo);
  const lungo = t.length > CARATTERI_BOLLA || t.split("\n").length > RIGHE_BOLLA;
  const [tutto, setTutto] = useState(false);
  const [copiato, setCopiato] = useState(false);
  const copia = () => void navigator.clipboard.writeText(t).then(() => { setCopiato(true); setTimeout(() => setCopiato(false), 1500); })
    .catch(() => avvisa({ tipo: "errore", messaggio: "Copia non riuscita" }));
  return (
    <div className="messaggio-roberto">
      <div className="contenuto-roberto">
        <div className={lungo && !tutto ? "bolla ridotta" : "bolla"}>{conLink(t)}</div>
        <div className="azioni-roberto">
          {lungo && (
            <button type="button" className={tutto ? "mostra-tutto aperto" : "mostra-tutto"} aria-expanded={tutto} onClick={() => conTransizione(() => setTutto(!tutto))}>
              <span>{tutto ? "Mostra meno" : "Mostra tutto"}</span><Icona nome="giu" />
            </button>
          )}
          <BottoneIcona icona={copiato ? "spunta" : "copia"} etichetta="Copia" onClick={copia} />
        </div>
      </div>
    </div>
  );
}

/** Testata apribile: freccia a destra da chiusa, in giù da aperta (varianti Chiusa/Aperta del disegno). */
function Testata({ icona, colore = "secondaria", aperta, onClick, children }: {
  icona: NomeIcona; colore?: "secondaria" | "errore" | "accento"; aperta?: boolean; onClick?(): void; children: ReactNode;
}) {
  return (
    <button type="button" className="testata" onClick={onClick} aria-expanded={onClick ? !!aperta : undefined} disabled={!onClick}>
      <Icona nome={icona} colore={colore} />
      {children}
      {onClick && <Icona nome={aperta ? "giu" : "destra"} />}
    </button>
  );
}

export function BloccoCodice({ comando, uscita, errore = false }: { comando?: string | null; uscita?: string; errore?: boolean }) {
  return (
    <div className="blocco-codice">
      {comando && <div className="comando">{comando}</div>}
      {uscita && <div className={errore ? "uscita errore" : "uscita"}>{uscita}</div>}
    </div>
  );
}

const Conti = ({ aggiunte, tolte }: { aggiunte: number; tolte: number }) => (
  <><span className="aggiunte">+{aggiunte}</span><span className="tolte">−{tolte}</span></>
);

export function Modifica({ b, aperta: iniziale }: { b: Extract<Blocco, { tipo: "modifica" }>; aperta: boolean }) {
  const [aperta, setAperta] = useState(iniziale);
  const ris = useRiserva();
  return (
    <div className="strumento modifica">
      <Testata icona="matita" aperta={aperta} onClick={() => conTransizione(() => setAperta(!aperta))}>
        <span className="tipo">Modificato</span>
        <span className="dettaglio">{b.file}</span>
        <Conti aggiunte={b.aggiunte} tolte={b.tolte} />
      </Testata>
      {aperta && (
        <div className="differenze">
          {b.righe.map((r, i) => (
            <div key={i} className={r.segno === "+" ? "riga aggiunta" : r.segno === "-" ? "riga tolta" : "riga"}>
              <span className="segno">{r.segno}</span><span className="codice">{ris.testo(r.codice)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FileToccati({ b, aperto: iniziale = false }: { b: Extract<Blocco, { tipo: "file-toccati" }>; aperto?: boolean }) {
  const [aperto, setAperto] = useState(iniziale);
  const somma = b.file.reduce((s, f) => ({ aggiunte: s.aggiunte + f.aggiunte, tolte: s.tolte + f.tolte }), { aggiunte: 0, tolte: 0 });
  return (
    <div className="file-toccati">
      <button type="button" className="testata" onClick={() => conTransizione(() => setAperto(!aperto))} aria-expanded={aperto}>
        <Icona nome="matita" />
        <span className="titolo">{quanti(b.file.length, "file modificato", "file modificati")}</span>
        <Conti {...somma} />
        <Icona nome={aperto ? "giu" : "destra"} />
      </button>
      {aperto && b.file.map((f) => (
        <div key={f.file} className="file">
          <Icona nome="file" />
          <span className="percorso">{f.file}</span>
          <Conti {...f} />
        </div>
      ))}
    </div>
  );
}
