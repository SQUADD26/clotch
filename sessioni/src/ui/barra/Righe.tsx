// figma: 101-7728 — righe della barra: «Riga comando», «Titolo sezione», «Riga progetto», «Riga sessione» (Riposo, Passaggio, Scelta).
import { memo, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import type { PreferenzeSessione, Profilo, Sessione } from "../../tipi";
import { BottoneIcona } from "../base/Bottone";
import { Icona, type NomeIcona } from "../base/Icona";
import { IconaSessione } from "../base/IconaSessione";
import { SegnoStato } from "../base/SegnoStato";
import { useRegistro } from "../clotch-ai/dati";
import { nonRisponde } from "../chat/clotch-ai";
import { STATI } from "./elenco";
import { IndicatorePr } from "./Pr";
import "./barra.css";

/** Suggerimento 101:24382: solo se il `.testo` della riga è troncato (#638), al passaggio e da tastiera. */
const suggerisci = (riga: HTMLElement, titolo: string, onTroncato: (titolo: string | null, el?: HTMLElement) => void) => {
  const t = riga.querySelector<HTMLElement>(".testo");
  onTroncato(t && t.scrollWidth > t.clientWidth ? titolo : null, t ?? undefined);
};

/** «Riga comando»: Cerca sessioni ⌘K, Filtra, Casella… (icona, etichetta, testo a destra). */
export function RigaComando({ icona, etichetta, lato, tasto, scelta, onClick }: { icona: NomeIcona; etichetta: string; lato?: string; tasto?: string; scelta?: boolean; onClick(e: MouseEvent<HTMLElement>): void }) {
  return (
    <button type="button" className={`riga ${scelta ? "scelta" : ""}`} data-comando={etichetta} onClick={onClick}>
      <Icona nome={icona} />
      <span className="testo">{etichetta}</span>
      {lato && <span className="lato t-sm secondario">{lato}</span>}
      {tasto && <span className="tasto-chip">{tasto}</span>}
    </button>
  );
}

export function TitoloSezione({ children }: { children: ReactNode }) {
  return <div className="riga titolo-sezione"><span className="testo t-sm secondario">{children}</span></div>;
}

/** Memo come RigaSessione: le funzioni non contano (Barra le fa chiamare sempre l'ultima versione). */
export const RigaCartella = memo(function RigaCartella({ nome, conteggio, aperta, onClick, onMenu, onTroncato }: { nome: string; conteggio: number; aperta: boolean; onClick(): void; onMenu(e: MouseEvent): void; onTroncato(titolo: string | null, el?: HTMLElement): void }) {
  return (
    <button type="button" className="riga" aria-expanded={aperta} onClick={onClick} onContextMenu={onMenu}
      onMouseEnter={(e) => suggerisci(e.currentTarget, nome, onTroncato)} onFocus={(e) => suggerisci(e.currentTarget, nome, onTroncato)} onMouseLeave={() => onTroncato(null)} onBlur={() => onTroncato(null)}>
      <Icona nome={aperta ? "cartella-aperta" : "cartella"} />
      <span className="testo">{nome}</span>
      <span className="lato t-sm secondario">{conteggio}</span>
    </button>
  );
}, (a, b) => a.nome === b.nome && a.conteggio === b.conteggio && a.aperta === b.aperta);

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

/** Memo: una riga si ridisegna solo se cambiano i suoi dati; le funzioni no (Barra le fa chiamare sempre l'ultima versione). */
const stessiDati = (a: PropsSessione, b: PropsSessione) =>
  (Object.keys({ ...a, ...b }) as (keyof PropsSessione)[]).every((k) => typeof a[k] === "function" || a[k] === b[k]);
export const RigaSessione = memo(function RigaSessione({ s, pref, scelta, fissata, passaggio, figlia, figlie = 0, figlieAperte = true, onFiglie, onApri, onIcona, onFissa, onMenu, onTroncato }: PropsSessione) {
  const entra = (e: { currentTarget: HTMLElement }) => suggerisci(e.currentTarget, s.titolo, onTroncato);
  const c = useRegistro().dati?.chat.get(s.id);
  // stessa regola della testata e del filo: una sessione che non risponde ha lo stesso segno ovunque
  const stato = s.situazione?.adesso === "errore" || (!!c && nonRisponde(c, Date.now())) ? "errore" : s.stato;
  return (
    <div
      role="button" tabIndex={0} aria-current={scelta || undefined} data-figlia={figlia || undefined}
      className={`riga riga-sessione ${scelta ? "scelta" : ""} ${passaggio ? "passaggio" : ""}`}
      onClick={onApri} onContextMenu={onMenu} onMouseEnter={entra} onMouseLeave={() => onTroncato(null)}
      onFocus={(e) => { if (e.target === e.currentTarget) entra(e); }} onBlur={(e) => { if (e.target === e.currentTarget) onTroncato(null); }}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onApri(); } }}
    >
      {figlia && <Icona nome="figlia" colore="terziaria" />}
      <button type="button" aria-label="Icona della sessione" title="Icona della sessione" onClick={(e) => { e.stopPropagation(); onIcona(e); }}>
        <IconaRiga titolo={s.titolo} pref={pref} />
      </button>
      {pref?.nonLetta && <span className="pallino-non-letta" role="img" aria-label="Non letta" />}
      <span className={["testo", s.stato === "lavora" && "lavoro", pref?.nonLetta && "medio"].filter(Boolean).join(" ")}>
        {s.titolo}
        {s.stato === "lavora" && <span className="luccica-area" aria-hidden="true"><span className="luccica-finestra"><span className="luccica-copia" data-titolo={s.titolo} /></span></span>}
      </span>
      {figlie > 0 && (
        <button type="button" className="freccia-figlie" aria-expanded={figlieAperte} aria-label={figlieAperte ? "Nascondi le figlie" : "Mostra le figlie"}
          onClick={(e) => { e.stopPropagation(); onFiglie?.(); }}>
          <Icona nome={figlieAperte ? "giu" : "destra"} />
        </button>
      )}
      {s.app?.prs.length ? <IndicatorePr pr={s.app.prs[s.app.prs.length - 1]} /> : null}
      <span className="segno" role="img" aria-label={STATI.find((x) => x.chiave === stato)!.voce}>
        <SegnoStato stato={stato} />{fissata && <Icona nome="spillo" colore="terziaria" />}
      </span>
      <span className="azioni" onClick={(e) => e.stopPropagation()}>
        <BottoneIcona icona="spillo" etichetta="Fissa in alto" onClick={onFissa} />
        <BottoneIcona icona="altro" etichetta="Altre azioni" onClick={onMenu} />
      </span>
    </div>
  );
}, stessiDati);

let letto: Promise<Profilo> | undefined;
/** Nome e iniziali dell'utente, dal main (account Claude o macOS); vuoti finché non arrivano. */
export function useProfilo(): Profilo {
  const [p, setP] = useState<Profilo>({ nome: "", iniziali: "" });
  useEffect(() => {
    letto ??= window.impostazioni.profilo();
    letto.then(setP, () => { letto = undefined; });
  }, []);
  return p;
}
