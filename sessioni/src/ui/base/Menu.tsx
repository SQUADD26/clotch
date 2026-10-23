// figma: 101-21010 — «menu sessione»: voci con icona, scorciatoia e separatori; testata del «menu profilo» 101-21498;
// voce pericolo rossa con la sua icona (101-21348). Si chiude con Esc o un clic fuori.
import { useEffect, useRef, type CSSProperties } from "react";
import { Icona, type NomeIcona } from "./Icona";
import "./menu.css";

export type VoceMenu =
  | { icona?: NomeIcona; etichetta: string; scorciatoia?: string; pericolo?: boolean; fai(): void }
  | "separatore";

interface Props {
  voci: VoceMenu[];
  onChiudi(): void;
  /** «intestazione menu»: nome e dettaglio in cima, poi un separatore. */
  testata?: { titolo: string; dettaglio?: string };
  style?: CSSProperties;
}

export function Menu({ voci, onChiudi, testata, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChiudi();
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const b = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
      const i = b.indexOf(document.activeElement as HTMLButtonElement);
      b[(i + (e.key === "ArrowDown" ? 1 : b.length - 1)) % b.length]?.focus();
      e.preventDefault();
    };
    const fuori = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onChiudi(); };
    addEventListener("keydown", tasto);
    addEventListener("mousedown", fuori);
    return () => { removeEventListener("keydown", tasto); removeEventListener("mousedown", fuori); };
  }, [onChiudi]);
  return (
    <div ref={ref} className="menu" role="menu" style={style}>
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
        : (
          <button key={i} type="button" role="menuitem" className="voce" onClick={() => { onChiudi(); v.fai(); }}>
            {v.icona && <Icona nome={v.icona} colore={v.pericolo ? "errore" : "secondaria"} />}
            <span className={`etichetta t-sm ${v.pericolo ? "pericolo" : ""}`}>{v.etichetta}</span>
            {v.scorciatoia && <span className="t-sm secondario">{v.scorciatoia}</span>}
          </button>
        ))}
    </div>
  );
}
