// figma: 101-13650 — richieste a Roberto: «Richiesta permesso» 101:13247, «Domanda» 101:13280 (101:13896), «Piano» 101:13314 (101:14132).
// Ogni risposta è un comando nella casella di Friday (contratto v1): rispondi_permesso, rispondi_domanda, salta_domanda, piano.
import { useEffect, useState, type ReactNode } from "react";
import { Bottone } from "../base/Bottone";
import { Icona, type NomeIcona } from "../base/Icona";
import { registraAzione } from "../base/scorciatoie";
import { useClotchAcceso } from "../pannello";
import { BloccoCodice } from "./Blocchi";
import { comanda } from "./friday";
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
      {dettaglio && <span className={codice ? "dettaglio codice" : "dettaglio"}>{ris.testo(dettaglio)}</span>}
    </div>
  );
}

export interface Richiesta { rid: string; strumento: string | null; ingresso: unknown }

type Scelta = "consenti" | "consenti_sempre" | "nega";

/** `titolo`: nella chat di clotch AI la carta dice di quale sessione è (101-37492). */
export function Permesso({ chat, r, da, titolo = "Permesso richiesto" }: { chat: string; r: Richiesta; da: string | null; titolo?: string }) {
  const [scelta, setScelta] = useState<Scelta | null>(null);
  const ris = useRiserva();
  const cmd = ris.testo(testoCampo(r.ingresso, "command")); // sempre intero: chi approva deve vedere gli argomenti, vale solo nascondiChiavi
  const mostra = cmd ? `$ ${cmd}` : r.strumento;
  const rispondi = async (s: Scelta) => { if (await comanda("rispondi_permesso", { chat, rid: r.rid, scelta: s })) setScelta(s); };
  // finché aspetta la risposta, le scorciatoie salvate «Consenti» e «Nega» rispondono a questo permesso
  useEffect(() => {
    if (scelta) return;
    const fuori = [registraAzione("consenti", () => void rispondi("consenti")), registraAzione("nega", () => void rispondi("nega"))];
    return () => fuori.forEach((f) => f());
  }, [scelta, chat, r.rid]); // eslint-disable-line react-hooks/exhaustive-deps
  if (scelta) {
    return scelta === "nega"
      ? <Esito icona="chiudi" colore="errore" esito="Negato da te" dettaglio={cmd || r.strumento || ""} codice />
      : <Esito icona="spunta" colore="successo" esito="Consentito da te" dettaglio={cmd || r.strumento || ""} codice />;
  }
  return (
    <Carta icona="mano" titolo={titolo} dettaglio={da}>
      {cmd && <div className="domanda">Eseguire questo comando?</div>}
      {mostra && <BloccoCodice comando={mostra} />}
      {testoCampo(r.ingresso, "description") && <div className="motivo">{ris.testo(testoCampo(r.ingresso, "description"))}</div>}
      <div className="bottoni">
        <Bottone onClick={() => rispondi("consenti")}>Consenti</Bottone>
        <Bottone tipo="secondario" onClick={() => rispondi("consenti_sempre")}>Consenti sempre</Bottone>
        <Bottone tipo="secondario" onClick={() => rispondi("nega")}>Nega</Bottone>
      </div>
    </Carta>
  );
}

const CONSIGLIATA = /\s*\((Recommended|Consigliata)\)\s*$/i;

/** `rid` null: la domanda è aperta nella trascrizione ma Friday non la conosce, e non si può rispondere da qui. */
export function Domanda({ chat, rid, domande, da }: { chat: string; rid: string | null; domande: { domanda: string; opzioni: string[] }[]; da: string | null }) {
  // l'opzione consigliata parte scelta, come nel disegno
  const [scelte, setScelte] = useState<(number | null)[]>(domande.map((d) => { const i = d.opzioni.findIndex((o) => CONSIGLIATA.test(o)); return i < 0 ? null : i; }));
  const [altro, setAltro] = useState("");
  const [fatta, setFatta] = useState<string | null>(null);
  const ris = useRiserva();
  if (fatta !== null) return <Esito icona="persona" colore="secondaria" esito="Hai risposto" dettaglio={fatta} />;
  const risposte = domande.map((d, i) => {
    const o = scelte[i];
    const scelta = o == null ? "" : d.opzioni[o].replace(CONSIGLIATA, "");
    return { domanda: d.domanda, scelta, testo: i === domande.length - 1 ? altro.trim() : "" };
  });
  const pronta = !!rid && risposte.every((r) => r.scelta || r.testo);
  const rispondi = async () => {
    if (pronta && await comanda("rispondi_domanda", { chat, rid, risposte })) setFatta(risposte.map((r) => r.testo || r.scelta).join(" · "));
  };
  const salta = async () => { if (rid && await comanda("salta_domanda", { chat, rid })) setFatta(""); };
  return (
    <>
      <Carta icona="persona" titolo="Domanda per te" dettaglio={da}>
        {domande.map((d, i) => (
          <div key={i} className="domanda-blocco">
            <div className="testo-domanda">{ris.testo(d.domanda)}</div>
            <div className="opzioni" role="radiogroup">
              {d.opzioni.map((o, j) => (
                <button key={j} type="button" role="radio" aria-checked={scelte[i] === j} className={scelte[i] === j ? "opzione scelta" : "opzione"}
                  onClick={() => setScelte(scelte.map((x, k) => (k === i ? j : x)))}>
                  <span className="numero">{j + 1}</span>
                  <span className="testo">{ris.testo(o.replace(CONSIGLIATA, ""))}</span>
                  {CONSIGLIATA.test(o) && <span className="nota">Consigliata</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
        <input className="altro" placeholder="Scrivi un’altra risposta" value={altro} onChange={(e) => setAltro(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void rispondi(); }} />
        <div className="bottoni">
          <Bottone onClick={rispondi} disabled={!pronta}>Rispondi</Bottone>
          <Bottone tipo="secondario" onClick={salta} disabled={!rid}>Salta</Bottone>
        </div>
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
  const ris = useRiserva();
  const { intro, passi } = passiPiano(testo);
  const nPassi = quanti(passi.length, "passo", "passi");
  if (esito === "approva") return <Esito icona="spunta" colore="successo" esito="Piano approvato" dettaglio={nPassi} />;
  const decidi = async (e: "approva" | "modifica") => { if (rid && await comanda("piano", { chat, rid, esito: e })) setEsito(e); };
  return (
    <Carta icona="libro" titolo="Piano da approvare" dettaglio={nPassi}>
      {intro && <div className="motivo">{ris.testo(intro)}</div>}
      <div className="passi">
        {passi.map((p, i) => <div key={i} className="passo"><span className="numero">{i + 1}</span><span className="testo">{ris.testo(p)}</span></div>)}
      </div>
      {esito !== "modifica" && (
        <div className="bottoni">
          <Bottone onClick={() => decidi("approva")} disabled={!rid}>Approva</Bottone>
          <Bottone tipo="secondario" onClick={() => decidi("modifica")} disabled={!rid}>Modifica</Bottone>
        </div>
      )}
    </Carta>
  );
}
