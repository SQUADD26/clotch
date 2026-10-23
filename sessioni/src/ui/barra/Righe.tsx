// figma: 101-7728 — righe della barra: «Riga comando», «Titolo sezione», «Riga progetto», «Riga sessione» (Riposo, Passaggio, Scelta), «Piede barra laterale».
import type { MouseEvent, ReactNode } from "react";
import type { PreferenzeSessione, Sessione } from "../../tipi";
import { BottoneIcona } from "../base/Bottone";
import { Icona, type NomeIcona } from "../base/Icona";
import { IconaSessione } from "../base/IconaSessione";
import { SegnoStato } from "../base/SegnoStato";
import { IndicatorePr } from "./Pr";
import "./barra.css";

/** «Riga comando»: Cerca sessioni ⌘K, Filtra, Casella… (icona, etichetta, testo a destra). */
export function RigaComando({ icona, etichetta, lato, scelta, onClick }: { icona: NomeIcona; etichetta: string; lato?: string; scelta?: boolean; onClick(e: MouseEvent<HTMLElement>): void }) {
  return (
    <button type="button" className={`riga ${scelta ? "scelta" : ""}`} onClick={onClick}>
      <Icona nome={icona} />
      <span className="testo">{etichetta}</span>
      {lato && <span className="lato t-sm secondario">{lato}</span>}
    </button>
  );
}

export function TitoloSezione({ children }: { children: ReactNode }) {
  return <div className="riga titolo-sezione"><span className="testo t-sm secondario">{children}</span></div>;
}

export function RigaCartella({ nome, conteggio, aperta, onClick, onMenu }: { nome: string; conteggio: number; aperta: boolean; onClick(): void; onMenu(e: MouseEvent): void }) {
  return (
    <button type="button" className="riga" aria-expanded={aperta} onClick={onClick} onContextMenu={onMenu}>
      <Icona nome={aperta ? "cartella-aperta" : "cartella"} />
      <span className="testo">{nome}</span>
      <span className="lato t-sm secondario">{conteggio}</span>
    </button>
  );
}

/** Segno all'inizio del titolo → icona (tabella 120:58483; ★ = stella arancione); senza scelta né segno: la stella argento di serie (101:12491). */
const SEGNI: Record<string, [string, string?]> = {
  "★": ["stella", "arancione"], "⛁": ["database"], "🎨": ["tavolozza"], "⚠": ["insetto"], "◰": ["strati"], "☁": ["globo"], "⚙": ["chiave"],
  "⌘": ["casa"], "⌕": ["bussola"], "☑": ["scudo"], "✎": ["libro"], "⇋": ["fulmine"], "♺": ["pacco"],
};
export function IconaRiga({ titolo, pref }: { titolo: string; pref?: PreferenzeSessione }) {
  const [icona, colore] = SEGNI[[...titolo.trim()][0] ?? ""] ?? [];
  return <IconaSessione icona={pref?.icona ?? icona} colore={pref?.colore ?? (pref?.icona ? undefined : colore)} />;
}

interface PropsSessione {
  s: Sessione;
  pref?: PreferenzeSessione;
  scelta: boolean;
  /** Nella sezione «Fissate» (101:21065): a destra lo spillo al posto dello stato. */
  fissata?: boolean;
  /** Solo per la prova di parità: la riga disegnata come al passaggio del mouse. */
  passaggio?: boolean;
  /** Sessione avviata da un'altra (101:34605): indentata, col suo segno «figlia». */
  figlia?: boolean;
  /** Quante figlie ha; con almeno una, la freccia le chiude e le apre. */
  figlie?: number;
  figlieAperte?: boolean;
  onFiglie?(): void;
  onApri(): void;
  onIcona(e: MouseEvent): void;
  onFissa(): void;
  onMenu(e: MouseEvent): void;
  onTroncato(titolo: string | null, el?: HTMLElement): void;
}

export function RigaSessione({ s, pref, scelta, fissata, passaggio, figlia, figlie = 0, figlieAperte = true, onFiglie, onApri, onIcona, onFissa, onMenu, onTroncato }: PropsSessione) {
  const entra = (e: MouseEvent<HTMLElement>) => {
    const t = e.currentTarget.querySelector<HTMLElement>(".testo");
    onTroncato(t && t.scrollWidth > t.clientWidth ? s.titolo : null, t ?? undefined);
  };
  return (
    <div
      role="button" tabIndex={0} aria-current={scelta || undefined}
      className={`riga riga-sessione ${scelta ? "scelta" : ""} ${passaggio ? "passaggio" : ""}`}
      onClick={onApri} onContextMenu={onMenu} onMouseEnter={entra} onMouseLeave={() => onTroncato(null)}
      onKeyDown={(e) => { if (e.key === "Enter") onApri(); }}
    >
      {figlia && <Icona nome="figlia" colore="terziaria" />}
      <button type="button" aria-label="Icona della sessione" onClick={(e) => { e.stopPropagation(); onIcona(e); }}>
        <IconaRiga titolo={s.titolo} pref={pref} />
      </button>
      <span className={`testo ${s.stato === "lavora" ? "lavoro" : ""}`}>{s.titolo}</span>
      {figlie > 0 && (
        <button type="button" className="freccia-figlie" aria-expanded={figlieAperte} aria-label={figlieAperte ? "Nascondi le figlie" : "Mostra le figlie"}
          onClick={(e) => { e.stopPropagation(); onFiglie?.(); }}>
          <Icona nome={figlieAperte ? "giu" : "destra"} />
        </button>
      )}
      {s.app?.prs.length ? <IndicatorePr pr={s.app.prs[s.app.prs.length - 1]} /> : null}
      <span className="segno">{fissata ? <Icona nome="spillo" colore="terziaria" /> : <SegnoStato stato={s.stato} />}</span>
      <span className="azioni" onClick={(e) => e.stopPropagation()}>
        <BottoneIcona icona="spillo" etichetta="Fissa in alto" onClick={onFissa} />
        <BottoneIcona icona="altro" etichetta="Altre azioni" onClick={onMenu} />
      </span>
    </div>
  );
}

export function Piede({ dettaglio, onMenu, onImpostazioni }: { dettaglio: string; onMenu(e: MouseEvent): void; onImpostazioni(): void }) {
  return (
    <div className="piede">
      <button type="button" className="avatar" onClick={onMenu}><span className="t-xs medio">RB</span></button>
      <button type="button" className="testi" onClick={onMenu}>
        <span>Roberto Bondici</span>
        <span className="t-xs secondario">{dettaglio}</span>
      </button>
      <BottoneIcona icona="impostazioni" etichetta="Impostazioni" onClick={onImpostazioni} />
    </div>
  );
}
