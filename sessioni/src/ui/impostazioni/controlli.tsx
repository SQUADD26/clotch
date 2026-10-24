// figma: 101-17193 — «Gruppo», «Riga impostazione» 101:7584, «Riga scelta» 101:17077, «Interruttore» 101:7467, «tasto», «Campo testo» 101:22042.
import { createContext, useContext, useState, type ReactNode } from "react";
import { Bottone } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { Menu } from "../base/Menu";
import { SEZIONI, type Sezione } from "./sezioni";
import "./impostazioni.css";
import "./tendine.css";

/** Finestra stretta (155:74691): la navigazione sparisce e il titolo della pagina diventa il selettore della sezione. */
export const Stretta = createContext<{ sezione: Sezione; scegli(s: Sezione): void } | null>(null);

function TitoloSezione({ titolo, sezione, scegli }: { titolo: string; sezione: Sezione; scegli(s: Sezione): void }) {
  const [aperto, setAperto] = useState(false);
  return (
    <h1 className="titolo-pagina t-xl scelta-sezione">
      <button type="button" className="valore" aria-haspopup="menu" aria-expanded={aperto} aria-label={`Sezione: ${titolo}`} onClick={() => setAperto((x) => !x)}>
        {titolo}<Icona nome="giu" />
      </button>
      {aperto && (
        <Menu onChiudi={() => setAperto(false)} classe="menu-scelta"
          voci={SEZIONI.map(([id, nome]) => ({ etichetta: nome, scelta: id === sezione, fai: () => scegli(id) }))} />
      )}
    </h1>
  );
}

export function Pagina({ titolo, sopra, children }: { titolo: string; sopra?: ReactNode; children: ReactNode }) {
  const stretta = useContext(Stretta);
  return (
    <div className="contenuto-impostazioni">
      {sopra}
      {stretta && !sopra ? <TitoloSezione titolo={titolo} {...stretta} /> : <h1 className="titolo-pagina t-xl">{titolo}</h1>}
      {children}
    </div>
  );
}

export const Gruppo = ({ children }: { children: ReactNode }) => <div className="gruppo">{children}</div>;

/** Una riga: etichetta e descrizione a sinistra, il controllo a destra. `azione` = riga con bottoni (gap più stretto). */
export function Riga({ etichetta, descrizione, errore = false, azione = false, className = "", children }: {
  etichetta: ReactNode; descrizione?: ReactNode; errore?: boolean; azione?: boolean; className?: string; children?: ReactNode;
}) {
  return (
    <div className={`riga ${azione ? "azione" : ""} ${className}`}>
      <div className="testi">
        <div className="t-base">{etichetta}</div>
        {descrizione !== undefined && <div className={`t-sm ${errore ? "errore" : "secondario"}`}>{descrizione}</div>}
      </div>
      {children}
    </div>
  );
}

export function Interruttore({ acceso, etichetta, onCambia, disabled }: {
  acceso: boolean; etichetta: string; onCambia(acceso: boolean): void; disabled?: boolean;
}) {
  return (
    <button type="button" role="switch" aria-checked={acceso} aria-label={etichetta} disabled={disabled}
      className={`interruttore ${acceso ? "acceso" : ""}`} onClick={() => onCambia(!acceso)}>
      <span className="manopola" />
    </button>
  );
}

/** Valore con la freccia: con `voci` apre la tendina (101:32999), senza è solo il valore. `dettagli`: la nota a destra di una voce (119:55555). */
export function Scelta({ valore, etichetta, voci, dettagli, onScegli, disabled }: {
  valore: string; etichetta: string; voci?: string[]; dettagli?: Record<string, string>; onScegli?(v: string): void; disabled?: boolean;
}) {
  const [aperta, setAperta] = useState(false);
  const chiudi = () => setAperta(false);
  return (
    <div className="scelta">
      <button type="button" className="valore" aria-label={`${etichetta}: ${valore}`} aria-haspopup={voci ? "menu" : undefined}
        aria-expanded={voci ? aperta : undefined} disabled={disabled || !voci} onClick={() => setAperta((x) => !x)}>
        <span className="t-sm secondario">{valore}</span>
        <Icona nome="giu" />
      </button>
      {aperta && voci && (
        <Menu onChiudi={chiudi} fine classe="menu-scelta"
          voci={voci.map((v) => ({ etichetta: v, scorciatoia: dettagli?.[v], scelta: v === valore, fai: () => onScegli?.(v) }))} />
      )}
    </div>
  );
}

/** Tasti di una scorciatoia, come «tasto» del frame Scorciatoie. */
export const Tasto = ({ tasti, errore = false }: { tasti: string; errore?: boolean }) =>
  <span className={`tasto-chip ${errore ? "errore" : ""}`}>{tasti}</span>;

/** «Campo testo»: un percorso da leggere, si cambia col bottone accanto. */
export const CampoTesto = ({ valore }: { valore: string }) => <div className="campo-testo t-base" title={valore}>{valore}</div>;

/** «vuoto lista»: titolo e corpo al centro del gruppo. */
export function VuotoLista({ titolo, corpo, allarme, children }: { titolo: string; corpo: string; allarme?: boolean; children?: ReactNode }) {
  return (
    <div className={`vuoto-lista ${children ? "con-bottone" : ""}`} role={allarme ? "alert" : undefined}>
      <div className="t-base">{titolo}</div>
      <div className="t-sm secondario">{corpo}</div>
      {children}
    </div>
  );
}

/** Lettura in corso, al posto delle righe: lo spinner del «Calcolando…» di Archiviazione (101-32155). */
export const Carica = ({ testo }: { testo: string }) => (
  <div className="riga calcolo" role="status"><Icona nome="spinner" gira /><span className="t-sm secondario">{testo}</span></div>
);

/** Lettura fallita, al posto delle righe: cosa non si è letto, il perché e «Riprova» (come StatoErrore, 101-9090). */
export const ErroreLista = ({ titolo, errore, riprova }: { titolo: string; errore: string; riprova(): void }) => (
  <VuotoLista titolo={titolo} corpo={errore} allarme><Bottone tipo="secondario" onClick={riprova}>Riprova</Bottone></VuotoLista>
);
