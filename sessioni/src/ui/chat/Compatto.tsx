// figma: 163-84565 — filo compatto (#876): «Gruppo strumenti» 163:84565, «Riga del gruppo» 163:84137, «Riga strumento» 163:84207,
// «Riga in corso» 163:84216, «Ragionamento» 163:84329, «Aiutante» 163:84382; schermate 163:87265 (al lavoro) … 163:90982 (finestra stretta).
// Chiuso di default: si apre solo se Roberto lo chiede. Gli errori si vedono anche da chiuso; ciò che gira ha il riflesso (fermo con «riduci movimento»).
import { useState, type ReactNode } from "react";
import { avvisa } from "../base/Avvisi";
import { BottoneIcona } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { conTransizione } from "../base/movimento";
import { Miniature } from "./Allegati";
import { compito, esitoErrore, fraseDi, type BloccoStrumento, type Gruppo as DatiGruppo } from "./gruppi";
import type { Aiutante, Blocco } from "./modello";
import { durata, quanti } from "./testi";
import { useRiserva } from "./riserva";
import "./compatto.css";

/** Sotto il secondo con un decimale, come nel disegno («0,4 s»). */
const tempo = (ms: number) => (ms < 950 ? `${(Math.max(ms, 100) / 1000).toFixed(1).replace(".", ",")} s` : durata(ms));

/** Testo con il riflesso che scorre (solo transform). Con «riduci movimento» il riflesso sparisce e resta il segno fermo `in-corso`. */
function Luccica({ testo, children }: { testo: string; children?: ReactNode }) {
  return (
    <>
      <span className="solo-fermo"><Icona nome="in-corso" /></span>
      <span className="luccica">
        {testo}
        <span className="luccica-area" aria-hidden="true"><span className="luccica-finestra"><span className="luccica-copia" data-testo={testo} /></span></span>
      </span>
      {children}
    </>
  );
}

const Freccia = ({ aperta }: { aperta: boolean }) => <span className="freccia-riga"><Icona nome={aperta ? "giu" : "destra"} colore="terziaria" /></span>;

/** Testo rientrato con la linea a sinistra: il ragionamento aperto e il rapporto di un aiutante. */
const Rientrato = ({ testo }: { testo: string }) => <div className="rientrato"><div className="testo">{testo}</div></div>;

export function Ragionamento({ b, aperto: iniziale = false }: { b: Extract<Blocco, { tipo: "pensiero" }>; aperto?: boolean }) {
  const [aperto, setAperto] = useState(iniziale);
  const r = useRiserva();
  if (b.inCorso) return <div className="compatto pensiero"><div className="riga-compatta in-corso"><Luccica testo="Sto ragionando…" /></div></div>;
  return (
    <div className="compatto pensiero">
      <button type="button" className="riga-compatta" aria-expanded={aperto} onClick={() => conTransizione(() => setAperto(!aperto))}>
        <span className="titolo">Ho ragionato per {durata(b.durata ?? 0)}</span>
        <Freccia aperta={aperto} />
      </button>
      {aperto && <Rientrato testo={r.testo(b.testo)} />}
    </div>
  );
}

function Copia({ testo }: { testo: string }) {
  const [fatto, setFatto] = useState(false);
  const copia = () => void navigator.clipboard.writeText(testo).then(() => { setFatto(true); setTimeout(() => setFatto(false), 1500); })
    .catch(() => avvisa({ tipo: "errore", messaggio: "Copia non riuscita" }));
  return <BottoneIcona icona={fatto ? "spunta" : "copia"} etichetta="Copia" onClick={copia} />;
}

/** Una chiamata del gruppo aperto: frase semplice; il comando grezzo e la sua uscita solo aprendo la riga. */
export function RigaStrumento({ b, aperta: iniziale = false }: { b: BloccoStrumento; aperta?: boolean }) {
  const [aperta, setAperta] = useState(iniziale);
  const r = useRiserva();
  const f = fraseDi(b);
  const errore = b.tipo === "strumento" && b.stato === "errore";
  const grezzo = b.tipo === "web" ? "" : b.comando ? r.comando(b.dettaglio) : r.testo(b.dettaglio);
  const fonti = b.tipo === "web" ? b.fonti : [];
  const apribile = !!grezzo || fonti.length > 0;
  return (
    <div className="riga-strumento">
      <div className="riga">
        <button type="button" className="apri" aria-expanded={apribile ? aperta : undefined} disabled={!apribile} onClick={() => conTransizione(() => setAperta(!aperta))}>
          <Icona nome={errore ? "avviso" : b.tipo === "web" ? "globo" : b.icona} colore={errore ? "errore" : "secondaria"} />
          <span className="azione">
            <span className="verbo">{r.testo(f.verbo)}</span>
            {f.oggetto && <>{" "}<span className="oggetto">{r.testo(f.oggetto)}</span></>}
            {errore && <>{" "}<span className="esito errore">{esitoErrore(b.uscita)}</span></>}
            {fonti.length > 0 && <>{" "}<span className="esito">· {quanti(fonti.length, "fonte", "fonti")}</span></>}
          </span>
          {apribile && <Freccia aperta={aperta} />}
        </button>
        {b.tipo === "strumento" && b.immagini?.length ? <span className="foto-strumento"><Miniature immagini={b.immagini.slice(0, 1)} nome={f.oggetto || f.verbo} /></span> : null}
        {b.tipo === "strumento" && b.durata != null && <span className="durata">{tempo(b.durata)}</span>}
      </div>
      {aperta && grezzo && (
        <div className="dettaglio-strumento">
          <div className="comando-grezzo">
            <div className="testo">{grezzo}{b.tipo === "strumento" && b.uscita.trim() && <span className={errore ? "uscita errore" : "uscita"}>{"\n"}{r.testo(b.uscita.trim())}</span>}</div>
            <Copia testo={grezzo} />
          </div>
        </div>
      )}
      {aperta && fonti.length > 0 && (
        <div className="dettaglio-strumento fonti">
          {fonti.map((x, i) => <div key={i} className="fonte"><Icona nome="globo" colore="terziaria" /><span className="titolo">{x.titolo}</span><span className="sito">{x.sito}</span></div>)}
        </div>
      )}
    </div>
  );
}

/** «Ho usato 12 strumenti · 48 s», chiuso. Mentre una chiamata gira, la testata è la riga in corso: «Leggo Filo.tsx… · 3 strumenti». */
/** `riga`: nelle scene di prova, la riga che parte aperta (163:87853). */
export function Gruppo({ g, aperto: iniziale = false, riga }: { g: DatiGruppo; aperto?: boolean; riga?: number }) {
  const [aperto, setAperto] = useState(iniziale);
  const r = useRiserva();
  const n = g.strumenti.length, ora = g.inCorso && fraseDi(g.inCorso);
  return (
    <div className="compatto gruppo-strumenti">
      <button type="button" className={ora ? "riga-compatta in-corso" : "riga-compatta"} aria-expanded={aperto} onClick={() => conTransizione(() => setAperto(!aperto))}>
        {ora ? (
          <Luccica testo={`${r.testo([ora.verbo, ora.oggetto].filter(Boolean).join(" "))}…`}>
            {n > 1 && <>{" "}<span className="conto">· {quanti(n, "strumento", "strumenti")}</span></>}
          </Luccica>
        ) : (
          <>
            <span className="titolo">Ho usato {quanti(n, "strumento", "strumenti")}</span>
            {g.durata > 0 && <>{" "}<span className="conto">· {tempo(g.durata)}</span></>}
          </>
        )}
        {g.errori.length > 0 && <>{" "}<Icona nome="avviso" colore="errore" /><span className="errori">{quanti(g.errori.length, "errore", "errori")}</span></>}
        {!ora && <Freccia aperta={aperto} />}
      </button>
      {aperto && (
        <div className="elenco-strumenti">
          <div className="righe">{g.strumenti.map((b, i) => <RigaStrumento key={b.chiave ?? i} b={b} aperta={i === riga} />)}</div>
        </div>
      )}
    </div>
  );
}

/** Un aiutante in una riga: «L'aiutante controlla i tipi · nessun errore», aperto col suo rapporto. */
function RigaAiutante({ a, aperto: iniziale = false }: { a: Aiutante; aperto?: boolean }) {
  const [aperto, setAperto] = useState(iniziale);
  const r = useRiserva();
  if (!a.finito) return (
    <div className="riga-strumento"><div className="riga in-corso">
      <span className="segno-aiutante"><Icona nome="figlia" colore="terziaria" /></span>
      <span className="azione"><span className="verbo">L'aiutante</span>{" "}<Luccica testo={`${compito(r.testo(a.nome))}…`} /></span>
      {a.durata != null && <span className="durata">{tempo(a.durata)}</span>}
    </div></div>
  );
  return (
    <div className="riga-strumento">
      <div className="riga">
        <button type="button" className="apri" aria-expanded={a.rapporto ? aperto : undefined} disabled={!a.rapporto} onClick={() => conTransizione(() => setAperto(!aperto))}>
          <Icona nome={a.errore ? "avviso" : "spunta"} colore={a.errore ? "errore" : "successo"} />
          <span className="azione">
            <span className="verbo">L'aiutante</span>{" "}<span className="oggetto">{compito(r.testo(a.nome))}</span>{" "}
            <span className={a.errore ? "esito errore" : "esito"}>{a.errore ? "· 1 errore" : "· nessun errore"}</span>
          </span>
          {a.rapporto && <Freccia aperta={aperto} />}
        </button>
        {a.durata != null && <span className="durata">{tempo(a.durata)}</span>}
      </div>
      {aperto && <Rientrato testo={r.testo(a.rapporto)} />}
    </div>
  );
}

/** `aperto`: nelle scene di prova il primo aiutante finito parte col rapporto aperto (163:88741). */
export const Aiutanti = ({ aiutanti, aperto = false }: { aiutanti: Aiutante[]; aperto?: boolean }) => (
  <div className="compatto aiutanti">{aiutanti.map((a) => <RigaAiutante key={a.id} a={a} aperto={aperto && a === aiutanti.find((x) => x.finito)} />)}</div>
);
