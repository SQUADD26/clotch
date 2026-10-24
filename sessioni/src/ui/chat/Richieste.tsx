// figma: 101-13650 — richieste a Roberto: «Richiesta permesso» 101:13247, «Domanda» 101:13280 (101:13896), «Piano» 101:13314 (101:14132).
// Ogni risposta è un comando nella casella di clotch AI (contratto v1): rispondi_permesso, rispondi_domanda, salta_domanda, piano.
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { Bottone } from "../base/Bottone";
import { Icona, type NomeIcona } from "../base/Icona";
import { registraAzione } from "../base/scorciatoie";
import type { DomandaTesto } from "./modello";
import { useClotchAcceso } from "../pannello";
import { BloccoCodice } from "./Blocchi";
import { comanda } from "./clotch-ai";
import { useInCorso } from "./inCorso";
import { useRiserva } from "./riserva";
import { testoCampo } from "./strumenti";
import { quanti } from "./testi";
import "./richieste.css";

function Carta({ icona, titolo, dettaglio, children }: { icona: NomeIcona; titolo: string; dettaglio?: string | null; children: ReactNode }) {
  return (
    <div className="carta-richiesta">
      <div className="testata-carta">
        <Icona nome={icona} colore="accento" />
        <span className="titolo">{titolo}</span>
        {dettaglio && <span className="dettaglio">{dettaglio}</span>}
      </div>
      {children}
    </div>
  );
}

/** Riga dopo la risposta: «Consentito da te», «Hai risposto», «Piano approvato». */
export function Esito({ icona, colore, esito, dettaglio, codice = false }: {
  icona: NomeIcona; colore: "successo" | "errore" | "secondaria"; esito: string; dettaglio?: string; codice?: boolean;
}) {
  const ris = useRiserva();
  return (
    <div className="esito-richiesta">
      <Icona nome={icona} colore={colore} />
      <span className="esito">{esito}</span>
      {dettaglio && <span className={codice ? "dettaglio codice" : "dettaglio"} title={ris.testo(dettaglio)}>{ris.testo(dettaglio)}</span>}
    </div>
  );
}

export interface Richiesta { rid: string; strumento: string | null; ingresso: unknown }

/** Gli argomenti dello strumento, una riga «chiave: valore» ciascuno, senza `description` (ha la sua riga): chi approva vede cosa approva. */
const argomenti = (ingresso: unknown) => !ingresso || typeof ingresso !== "object" ? "" : Object.entries(ingresso as Record<string, unknown>)
  .filter(([k, v]) => k !== "description" && ["string", "number", "boolean"].includes(typeof v) && v !== "").map(([k, v]) => `${k}: ${v}`).join("\n");

type Scelta = "consenti" | "consenti_sempre" | "nega";

/** `titolo`: nella chat di clotch AI la carta dice di quale sessione è (101-37492). */
export function Permesso({ chat, r, da, titolo = "Permesso richiesto" }: { chat: string; r: Richiesta; da: string | null; titolo?: string }) {
  const [scelta, setScelta] = useState<Scelta | null>(null);
  const { inCorso, fai } = useInCorso();
  const ris = useRiserva();
  const cmd = ris.testo(testoCampo(r.ingresso, "command")); // sempre intero: chi approva deve vedere gli argomenti, vale solo nascondiChiavi
  const args = cmd ? "" : ris.testo(argomenti(r.ingresso));
  const mostra = cmd ? `$ ${cmd}` : [r.strumento, args].filter(Boolean).join("\n");
  const cosa = cmd || args.split("\n")[0] || r.strumento || "";
  const rispondi = (s: Scelta) => fai(async () => { if (await comanda("rispondi_permesso", { chat, rid: r.rid, scelta: s })) setScelta(s); });
  // finché aspetta la risposta, le scorciatoie salvate «Consenti» e «Nega» rispondono a questo permesso
  useEffect(() => {
    if (scelta) return;
    const fuori = [registraAzione("consenti", () => void rispondi("consenti")), registraAzione("nega", () => void rispondi("nega"))];
    return () => fuori.forEach((f) => f());
  }, [scelta, chat, r.rid]); // eslint-disable-line react-hooks/exhaustive-deps
  if (scelta) {
    return scelta === "nega"
      ? <Esito icona="chiudi" colore="errore" esito="Negato da te" dettaglio={cosa} codice />
      : <Esito icona="spunta" colore="successo" esito={scelta === "consenti_sempre" ? "Consentito sempre" : "Consentito da te"} dettaglio={cosa} codice />;
  }
  return (
    <Carta icona="mano" titolo={titolo} dettaglio={da}>
      {mostra && <div className="domanda">{cmd ? "Eseguire questo comando?" : "Usare questo strumento?"}</div>}
      {mostra && <BloccoCodice comando={mostra} />}
      {testoCampo(r.ingresso, "description") && <div className="motivo">{ris.testo(testoCampo(r.ingresso, "description"))}</div>}
      <div className="bottoni">
        <Bottone disabled={inCorso} onClick={() => rispondi("consenti")}>Consenti</Bottone>
        <Bottone tipo="secondario" disabled={inCorso} onClick={() => rispondi("consenti_sempre")}>Consenti sempre</Bottone>
        <Bottone tipo="secondario" disabled={inCorso} onClick={() => rispondi("nega")}>Nega</Bottone>
      </div>
    </Carta>
  );
}

const CONSIGLIATA = /\s*\((Recommended|Consigliata)\)\s*$/i;

/** Frecce nel gruppo di opzioni (role radiogroup): scelgono la vicina e le portano il fuoco, in giro. */
function frecceOpzioni(e: KeyboardEvent<HTMLDivElement>, n: number, scegli: (j: number) => void) {
  const passo = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? n - 1 : 0;
  if (!passo) return;
  const bottoni = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button")], i = bottoni.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  const j = (i + passo) % n;
  scegli(j); bottoni[j].focus();
}

/** Perché i bottoni sono spenti: la domanda non è di clotch AI (si risponde dal terminale) o manca ancora una scelta. */
const NotaSolaLettura = () => <div className="nota-voce"><Icona nome="terminale" /><span>Rispondi dal terminale: clotch AI non vede questa richiesta</span></div>;

/** `rid` null: la domanda è aperta nella trascrizione ma clotch AI non la conosce, e non si può rispondere da qui. */
export function Domanda({ chat, rid, domande, da }: { chat: string; rid: string | null; domande: DomandaTesto[]; da: string | null }) {
  // l'opzione consigliata parte scelta, come nel disegno
  const [scelte, setScelte] = useState<number[][]>(domande.map((d) => { const i = d.opzioni.findIndex((o) => CONSIGLIATA.test(o)); return i < 0 ? [] : [i]; }));
  const [altro, setAltro] = useState<string[]>(domande.map(() => ""));
  const [fatta, setFatta] = useState<{ testo: string; saltata: boolean } | null>(null);
  const { inCorso, fai } = useInCorso();
  const ris = useRiserva();
  if (fatta !== null) return fatta.saltata ? <Esito icona="persona" colore="secondaria" esito="Saltata" /> : <Esito icona="persona" colore="secondaria" esito="Hai risposto" dettaglio={fatta.testo} />;
  const scegli = (i: number, j: number) => setScelte(scelte.map((x, k) => k !== i ? x : domande[i].multi ? (x.includes(j) ? x.filter((y) => y !== j) : [...x, j].sort()) : [j]));
  const risposte = domande.map((d, i) => ({
    domanda: d.domanda, scelta: scelte[i].map((o) => d.opzioni[o].replace(CONSIGLIATA, "")).join(", "), testo: altro[i].trim(),
  }));
  const manca = risposte.findIndex((r) => !r.scelta && !r.testo);
  const pronta = !!rid && !inCorso && manca < 0;
  const rispondi = () => pronta ? fai(async () => { if (await comanda("rispondi_domanda", { chat, rid, risposte })) setFatta({ testo: risposte.map((r) => r.testo || r.scelta).join(" · "), saltata: false }); }) : undefined;
  const salta = () => rid ? fai(async () => { if (await comanda("salta_domanda", { chat, rid })) setFatta({ testo: "", saltata: true }); }) : undefined;
  return (
    <>
      <Carta icona="persona" titolo="Domanda per te" dettaglio={da}>
        {domande.map((d, i) => (
          <div key={i} className="domanda-blocco">
            {d.header && <div className="intestazione-domanda">{ris.testo(d.header)}</div>}
            <div className="testo-domanda">{ris.testo(d.domanda)}</div>
            <div className="opzioni" role={d.multi ? "group" : "radiogroup"} aria-label={d.domanda}
              onKeyDown={(e) => frecceOpzioni(e, d.opzioni.length, (j) => { if (!d.multi) scegli(i, j); })}>
              {d.opzioni.map((o, j) => (
                <button key={j} type="button" role={d.multi ? "checkbox" : "radio"} aria-checked={scelte[i].includes(j)} className={scelte[i].includes(j) ? "opzione scelta" : "opzione"}
                  onClick={() => scegli(i, j)}>
                  <span className="numero">{j + 1}</span>
                  <span className="testo">{ris.testo(o.replace(CONSIGLIATA, ""))}{d.descrizioni?.[j] && <span className="descrizione">{ris.testo(d.descrizioni[j])}</span>}</span>
                  {CONSIGLIATA.test(o) && <span className="nota">Consigliata</span>}
                </button>
              ))}
            </div>
            <input className="altro" placeholder="Scrivi un’altra risposta" value={altro[i]} aria-label={`Un’altra risposta a: ${d.domanda}`}
              onChange={(e) => setAltro(altro.map((x, k) => (k === i ? e.target.value : x)))} onKeyDown={(e) => { if (e.key === "Enter") void rispondi(); }} />
          </div>
        ))}
        <div className="bottoni">
          <Bottone onClick={rispondi} disabled={!pronta}>Rispondi</Bottone>
          <Bottone tipo="secondario" onClick={salta} disabled={!rid || inCorso}>Salta</Bottone>
        </div>
        {!rid ? <NotaSolaLettura /> : manca >= 0 && <div className="nota-voce"><span>{domande.length > 1 ? `Manca la risposta alla domanda ${manca + 1}` : "Scegli o scrivi una risposta"}</span></div>}
      </Carta>
      <NotaVoce acceso="Rispondi anche a voce dal notch: ⌥Spazio" spento="Rispondi qui o a voce con ⌥Spazio" />
    </>
  );
}

/** Nota sotto la richiesta, con o senza Clotch (coppia CL5 di «Con e senza Clotch», 101:47850 e 101:47883). */
export function NotaVoce({ acceso, spento }: { acceso: string; spento: string }) {
  const c = useClotchAcceso();
  return <div className="nota-voce"><Icona nome={c ? "schermo" : "microfono"} /><span>{c ? acceso : spento}</span></div>;
}

/** Passi del piano: le righe «1. …» o «- …» del testo; il resto prima dei passi è l'introduzione. */
export function passiPiano(testo: string) {
  const righe = testo.split("\n").map((r) => r.trim()).filter(Boolean);
  const passo = /^(\d+[.)]|[-*])\s+/;
  const passi = righe.filter((r) => passo.test(r)).map((r) => r.replace(passo, "").replace(/\*\*/g, ""));
  const primo = righe.findIndex((r) => passo.test(r));
  const intro = righe.slice(0, primo < 0 ? 1 : primo).filter((r) => !r.startsWith("#")).join(" ");
  return { intro, passi };
}

export function Piano({ chat, rid, testo }: { chat: string; rid: string | null; testo: string }) {
  const [esito, setEsito] = useState<"approva" | "modifica" | null>(null);
  const { inCorso, fai } = useInCorso();
  const ris = useRiserva();
  const { intro, passi } = passiPiano(testo);
  const nPassi = quanti(passi.length, "passo", "passi");
  if (esito === "modifica") return <Esito icona="matita" colore="secondaria" esito="Modifica chiesta" dettaglio={nPassi} />;
  if (esito === "approva") return <Esito icona="spunta" colore="successo" esito="Piano approvato" dettaglio={nPassi} />;
  const decidi = (e: "approva" | "modifica") => fai(async () => { if (rid && await comanda("piano", { chat, rid, esito: e })) setEsito(e); });
  return (
    <Carta icona="libro" titolo="Piano da approvare" dettaglio={nPassi}>
      {intro && <div className="motivo">{ris.testo(intro)}</div>}
      <div className="passi">
        {passi.map((p, i) => <div key={i} className="passo"><span className="numero">{i + 1}</span><span className="testo">{ris.testo(p)}</span></div>)}
      </div>
      <div className="bottoni">
        <Bottone onClick={() => decidi("approva")} disabled={!rid || inCorso}>Approva</Bottone>
        <Bottone tipo="secondario" onClick={() => decidi("modifica")} disabled={!rid || inCorso}>Modifica</Bottone>
      </div>
      {!rid && <NotaSolaLettura />}
    </Carta>
  );
}
