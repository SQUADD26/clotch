// figma: 101-8036 — blocchi del filo: «Messaggio Roberto» 101:7210, «Risposta» 101:7216, «Blocco codice» 101:7213,
// «Pensiero» 101:7238, «Chiamata strumento» 101:7278, «Modifica file» 101:13464, «File toccati» 101:7315, «Ricerca sul web» 101:13525 (finestra «Ricerca sul web»: 101-15577).
import { useContext, useState, type ReactNode } from "react";
import { avvisa } from "../base/Avvisi";
import { BottoneIcona } from "../base/Bottone";
import { Icona, type NomeIcona } from "../base/Icona";
import { Miniature, VisoreContesto } from "./Allegati";
import { nomeFile } from "./percorsi";
import type { Blocco } from "./modello";
import { durata, quanti } from "./testi";
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

export function Pensiero({ b, aperto: iniziale = false }: { b: Extract<Blocco, { tipo: "pensiero" }>; aperto?: boolean }) {
  const [aperto, setAperto] = useState(iniziale);
  const r = useRiserva();
  if (b.inCorso) return <div className="pensiero"><div className="testata"><span className="etichetta">Ragionando…</span></div></div>;
  return (
    <div className="pensiero">
      <button type="button" className="testata" onClick={() => conTransizione(() => setAperto(!aperto))} aria-expanded={aperto}>
        <span className="etichetta">Ragionato per {durata(b.durata ?? 0)}</span>
        <Icona nome={aperto ? "giu" : "destra"} />
      </button>
      {aperto && <div className="testo-pensiero">{r.testo(b.testo)}</div>}
    </div>
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

// un'uscita di più di RIGHE_LUNGA righe si vede per RIGHE_ANTEPRIMA righe, con «Mostra tutto (84 righe)» sotto (101:28652)
const RIGHE_LUNGA = 8, RIGHE_ANTEPRIMA = 3;

export function Strumento({ b, aperta: iniziale = false }: { b: Extract<Blocco, { tipo: "strumento" }>; aperta?: boolean }) {
  const [aperta, setAperta] = useState(iniziale || b.stato === "errore");
  const [tutto, setTutto] = useState(false);
  const righe = b.uscita.replace(/\n+$/, "").split("\n");
  const lunga = righe.length > RIGHE_LUNGA;
  const apribile = b.stato !== "in-corso" && !!(b.comando || b.uscita);
  const r = useRiserva();
  const { sessione, apri } = useContext(VisoreContesto);
  // uno strumento che ha dato immagini («Schermata»): la testata apre la prima nel visore (101:28041)
  const primaImmagine = b.immagini?.[0];
  const dettaglio = b.comando ? r.comando(b.dettaglio) : r.testo(b.dettaglio);
  return (
    <div className="strumento">
      <Testata icona={b.stato === "in-corso" ? "in-corso" : b.stato === "errore" ? "avviso" : b.icona} colore={b.stato === "errore" ? "errore" : "secondaria"}
        aperta={aperta} onClick={apribile ? () => conTransizione(() => setAperta(!aperta)) : primaImmagine ? () => apri({ sessione, rif: primaImmagine }) : undefined}>
        <span className={b.stato === "errore" ? "tipo errore" : "tipo"}>{b.etichetta}</span>
        <span className="dettaglio">{dettaglio}</span>
        {b.durata != null && b.stato !== "in-corso" && <span className="durata">{durata(b.durata)}</span>}
      </Testata>
      {aperta && apribile && <BloccoCodice comando={b.comando && `$ ${dettaglio}`} errore={b.stato === "errore"}
        uscita={b.uscita && r.testo(lunga && !tutto ? righe.slice(0, RIGHE_ANTEPRIMA).join("\n") : b.uscita)} />}
      {aperta && apribile && lunga && (
        <button type="button" className={tutto ? "mostra-tutto aperto" : "mostra-tutto"} aria-expanded={tutto} onClick={() => conTransizione(() => setTutto(!tutto))}>
          <span>{tutto ? "Mostra meno" : `Mostra tutto (${quanti(righe.length, "riga", "righe")})`}</span>
          <Icona nome="giu" />
        </button>
      )}
      {b.immagini && <Miniature immagini={b.immagini} nome={nomeFile(b.dettaglio) || b.etichetta} />}
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

export function RicercaWeb({ b }: { b: Extract<Blocco, { tipo: "web" }> }) {
  const [aperta, setAperta] = useState(true);
  return (
    <div className="strumento web">
      <Testata icona="globo" aperta={aperta} onClick={b.fonti.length ? () => conTransizione(() => setAperta(!aperta)) : undefined}>
        <span className="tipo">Cercato sul web</span>
        <span className="dettaglio">{b.query}</span>
        {b.fonti.length > 0 && <span className="durata">{quanti(b.fonti.length, "fonte", "fonti")}</span>}
      </Testata>
      {aperta && b.fonti.length > 0 && (
        <div className="fonti">
          {b.fonti.map((f, i) => (
            <div key={i} className="fonte">
              <Icona nome="globo" colore="terziaria" />
              <span className="titolo">{f.titolo}</span>
              <span className="sito">{f.sito}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
