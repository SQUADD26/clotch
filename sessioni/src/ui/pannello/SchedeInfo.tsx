// figma: 101-33775 — schede del pannello «Info sessione» (componente «Pannello info» 101:33614): Ambiente, Contesto, Connettori, Modifiche.
// Contesto: le categorie (messaggi, file di memoria, strumenti…) le dà solo il comando /context di Claude Code e non stanno nei file: qui il totale usato.
import { Fragment, useState, type ReactNode } from "react";
import type { InfoSessione, PrInfo, Sessione } from "../../tipi";
import { ICONA_PR } from "../barra/Pr";
import { Icona, type NomeIcona } from "../base/Icona";
import { conTransizione } from "../base/movimento";
import { nomeAccount } from "../chat/testi";
import { percento, testoPr, token } from "./info";
import "./info.css";

function Scheda({ titolo, aperta, onAlterna, dettaglio, children }: { titolo: string; aperta: boolean; onAlterna(): void; dettaglio?: string; children?: ReactNode }) {
  return (
    <section className="scheda">
      <button type="button" className="testata" aria-expanded={aperta} onClick={() => conTransizione(onAlterna)}>
        <span className="t-base medio">{titolo}</span>
        <Icona nome={aperta ? "giu" : "destra"} />
        <span className="spazio" />
        {dettaglio && <span className="t-sm secondario">{dettaglio}</span>}
      </button>
      {aperta && children}
    </section>
  );
}

const Riga = ({ icona, colore, children, lato }: { icona: NomeIcona; colore?: "successo" | "viola" | "errore"; children: ReactNode; lato?: ReactNode }) => (
  <div className="riga-info"><Icona nome={icona} colore={colore} /><span className="t-sm testo" title={[children].flat().every((c) => typeof c === "string" || typeof c === "number") ? [children].flat().join("") : undefined}>{children}</span>{lato}</div>
);

/** «/Users/privato/Documents/Repos/goal-notch» -> «goal-notch · ~/Documents/Repos». */
const doveSta = (s: Sessione) => {
  const cartella = s.cartella.replace(/\/+$/, "");
  const dir = cartella.replace(/\/[^/]*$/, "").replace(/^\/(Users|home)\/[^/]+/, "~");
  return cartella ? `${cartella.replace(/^.*\//, "")}, ${dir}` : s.progetto;
};

export function Ambiente({ s }: { s: Sessione }) {
  const [aperta, setAperta] = useState(true);
  return (
    <Scheda titolo="Ambiente" aperta={aperta} onAlterna={() => setAperta(!aperta)}>
      <Riga icona="computer">{s.app?.ospite ?? "Questo Mac"}</Riga>
      <Riga icona="cartella">{doveSta(s)}</Riga>
      {s.ramo && <Riga icona="ramo">{s.ramo}</Riga>}
      <Riga icona="persona">{nomeAccount(s.account)}</Riga>
      {s.app?.cli && <Riga icona="terminale">Claude Code {s.app.cli}</Riga>}
      {s.app && (
        <div className="riga-info">
          <Icona nome="telefonino" /><span className="t-sm testo">Controllo remoto</span>
          {/* solo lettura: lo si cambia dall'app Claude, i suoi file non si scrivono da qui */}
          <span role="switch" aria-checked={s.app.remoto} aria-readonly title="Si cambia dall’app Claude" className={`interruttore ${s.app.remoto ? "acceso" : ""}`}><span className="manopola" /></span>
        </div>
      )}
    </Scheda>
  );
}

/** `max` = finestra dichiarata dal motore (`contesto_max`); senza, solo i token usati: niente percentuale né «usati / totale». */
export function Contesto({ usati, max, mcp }: { usati: number; max: number | null; mcp: number }) {
  const [aperta, setAperta] = useState(true);
  const usato = max ? Math.min(usati / max, 1) : 0, libero = max ? max - Math.min(usati, max) : 0;
  // soglie: da 80% si avvisa, da 95% è quasi pieno; oltre il limite lo si dice
  const livello = usato >= 0.95 ? "pieno" : usato >= 0.8 ? "quasi" : "";
  const oltre = !!max && usati > max;
  return (
    <Scheda titolo="Contesto" aperta={aperta} onAlterna={() => setAperta(!aperta)}>
      {!max ? <div className="riga-info"><span className="t-sm testo">Usato</span><span className="t-sm secondario">{token(usati)}</span></div> : <>
      <div className="uso">
        <span className={`t-sm testo ${livello}`}>{oltre ? "Oltre il limite" : `Usato ${percento(usato, 0)}`}</span>
        <span className="t-sm secondario">{token(usati)} / {token(max)}</span>
      </div>
      <div className="barra-contesto" role="meter" aria-label="Contesto usato" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usato * 100)}><span className={`parte ${livello}`} style={{ width: `${usato * 100}%` }} /></div>
      <div className="voci-contesto">
        <div className="voce"><span className="campione usato" /><span className="t-sm secondario nome">Usato</span><span className="t-sm secondario">{token(usati)}</span><span className="t-sm">{percento(usato)}</span></div>
        <div className="voce"><span className="campione libero" /><span className="t-sm secondario nome">Spazio libero</span><span className="t-sm secondario">{token(libero)}</span><span className="t-sm">{percento(1 - usato)}</span></div>
      </div></>}
      {mcp > 0 && <div className="riga-info"><span className="t-sm testo">Strumenti dei connettori</span><span className="t-sm secondario">{mcp}</span></div>}
    </Scheda>
  );
}

export function Connettori({ nomi }: { nomi: string[] }) {
  const [aperta, setAperta] = useState(false);
  return (
    <Scheda titolo="Connettori" aperta={aperta} onAlterna={() => setAperta(!aperta)} dettaglio={aperta ? undefined : `Connessi: ${nomi.length}`}>
      {nomi.map((n) => <Riga key={n} icona="connettore">{n}</Riga>)}
    </Scheda>
  );
}

// shortcut: lo stato «bozza» non è nei file dell'app; di una PR della sola trascrizione (stato null) si sa il numero: icona neutra «link», niente stato
export function Modifiche({ file, prs }: { file: InfoSessione["file"]; prs: PrInfo[] }) {
  const [aperta, setAperta] = useState(true);
  return (
    <Scheda titolo="Modifiche" aperta={aperta} onAlterna={() => setAperta(!aperta)}>
      {file.quanti > 0 && (
        <Riga icona="file" lato={<span className="t-sm secondario">+{file.aggiunte} −{file.tolte}</span>}>{file.quanti} file</Riga>
      )}
      {!!file.nomi?.length && <div className="elenco-file">{file.nomi.map((n) => <div key={n} className="riga-info" title={n}><Icona nome="file" /><span className="t-sm testo">{n.replace(/^.*\//, "")}</span></div>)}</div>}
      {prs.map((pr) => (
        <Fragment key={pr.url}>
          {pr.stato ? <Riga icona={ICONA_PR[pr.stato][0]} colore={ICONA_PR[pr.stato][1]}>{testoPr({ ...pr, stato: pr.stato })}</Riga> : <Riga icona="link">PR #{pr.numero}</Riga>}
          <a className="bottone secondario apri-pr" href={pr.url} target="_blank" rel="noreferrer noopener" aria-label={`Apri la PR #${pr.numero}`}>Apri la PR</a>
        </Fragment>
      ))}
    </Scheda>
  );
}
