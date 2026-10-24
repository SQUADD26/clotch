// figma: 101-21010 — «menu sessione»: voci con icona, scorciatoia e separatori; testata del «menu profilo» 101-21498;
// voce pericolo rossa con la sua icona (101-21348); voci con scelta fatta, spunta a sinistra (101-32999). Galleggia con base/Sovrapposto:
// sopra a tutto, accanto a chi lo apre, dentro la finestra; Esc o clic fuori chiudono e il fuoco torna al bottone.
import { useEffect, useState } from "react";
import { Icona, type NomeIcona } from "./Icona";
import { Sovrapposto, type Ancora, type Lato } from "./Sovrapposto";
import "./menu.css";

export type VoceMenu =
  /** `scelta`: se una voce la ha, tutte tengono il posto della spunta; si vede solo su quella scelta. */
  | { icona?: NomeIcona; etichetta: string; scorciatoia?: string; pericolo?: boolean; scelta?: boolean; fai(): void }
  /** Titolo di un gruppo di voci («Skill», 101-25845). */
  | { gruppo: string }
  | "separatore";

interface Props {
  voci: VoceMenu[];
  onChiudi(): void;
  /** «intestazione menu»: nome e dettaglio in cima, poi un separatore. */
  testata?: { titolo: string; dettaglio?: string };
  /** Assente: sotto il contenitore del bottone che lo apre (vedi Sovrapposto). */
  ancora?: Ancora;
  lato?: Lato;
  /** Allineato a destra del bottone. */
  fine?: boolean;
  scarto?: number;
  /** Classe in più per il CSS del pezzo che lo apre. */
  classe?: string;
  /** Voce che ha il fuoco all'apertura, se nessuna è scelta (di serie la prima). Conta solo le voci, non i separatori. */
  inizio?: number;
}

export function Menu({ voci, onChiudi, testata, ancora, lato, fine, scarto, classe, inizio = 0 }: Props) {
  const conScelta = voci.some((v) => v !== "separatore" && "fai" in v && v.scelta !== undefined);
  // il contenuto arriva al secondo giro (Sovrapposto aspetta di sapere dove sta): l'effetto parte quando c'è
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!el) return;
    (el.querySelector<HTMLButtonElement>("button.scelta") ?? el.querySelectorAll<HTMLButtonElement>("button")[inizio])?.focus();
    const tasto = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
      const b = [...el.querySelectorAll<HTMLButtonElement>("button")];
      const i = b.indexOf(document.activeElement as HTMLButtonElement);
      b[e.key === "Home" ? 0 : e.key === "End" ? b.length - 1 : (i + (e.key === "ArrowDown" ? 1 : b.length - 1)) % b.length]?.focus();
      e.preventDefault();
    };
    const scatola = el.parentElement ?? el; // anche i tasti mandati al menu intero
    scatola.addEventListener("keydown", tasto);
    return () => scatola.removeEventListener("keydown", tasto);
  }, [el]);
  return (
    <Sovrapposto ancora={ancora} lato={lato} fine={fine} scarto={scarto} className={classe ? `menu ${classe}` : "menu"} role="menu" onChiudi={onChiudi}>
      <div ref={setEl} className="voci-menu">
      {testata && (
        <>
          <div className="testata">
            <span className="t-sm medio">{testata.titolo}</span>
            {testata.dettaglio && <span className="t-xs secondario">{testata.dettaglio}</span>}
          </div>
          <div className="separatore" role="separator"><div className="linea" /></div>
        </>
      )}
      {voci.map((v, i) => v === "separatore"
        ? <div key={i} className="separatore" role="separator"><div className="linea" /></div>
        : "gruppo" in v ? <div key={i} className="titolo-gruppo t-xs secondario">{v.gruppo}</div>
        : (
          <button key={i} type="button" role={conScelta ? "menuitemradio" : "menuitem"} aria-checked={conScelta ? !!v.scelta : undefined}
            className={v.scelta ? "voce scelta" : "voce"} onMouseEnter={(e) => e.currentTarget.focus()} onClick={() => { onChiudi(); v.fai(); }}>
            {conScelta && <span className={v.scelta ? "spunta" : "spunta nascosta"}><Icona nome="spunta" colore="primaria" /></span>}
            {v.icona && <Icona nome={v.icona} colore={v.pericolo ? "errore" : "secondaria"} />}
            <span className={`etichetta t-sm ${v.pericolo ? "pericolo" : ""}`}>{v.etichetta}</span>
            {v.scorciatoia && <span className="t-sm secondario">{v.scorciatoia}</span>}
          </button>
        ))}
      </div>
    </Sovrapposto>
  );
}
