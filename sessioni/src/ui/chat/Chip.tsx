// figma: 101-26140 — «chip permessi» 101:24819, «contesto» 101:24825 con «tooltip» 101:26425, «menu permessi» 101:26398;
// 101-26427 — «chip modello» 101:24829 e «menu modello» 101:26707: modello, sforzo a 5 tacche, modalità rapida, reimposta.
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import type { PreferenzeSessione, Sessione } from "../../tipi";
import { api } from "../base/dati";
import { Icona } from "../base/Icona";
import { Interruttore } from "../impostazioni/controlli";
import { etichettaModello, MODELLI_MENU, nomeModello, modelloDi, PERMESSI, permessiDi, percentoContesto, sforzoDi, SFORZI, SFORZO_BASE, type Scelta } from "./scelte";
import "./scelte.css";

type Imposta = (parte: Partial<{ [K in keyof PreferenzeSessione]: PreferenzeSessione[K] | null }>) => void;
type Dati = { s: Pick<Sessione, "modello" | "permessi" | "contesto">; p?: PreferenzeSessione };

/** Un chip che apre il suo menu sopra di sé. Esc o un clic fuori lo chiudono; le frecce passano da una voce all'altra. */
function ChipMenu({ aperto, onAperto, lato, etichetta, disabled, chip, children }: {
  aperto: boolean; onAperto(a: boolean): void; lato: "sinistra" | "destra"; etichetta: string; disabled?: boolean; chip: ReactNode; children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!aperto) return;
    const voci = () => [...(ref.current?.querySelectorAll<HTMLButtonElement>(".menu-casella button") ?? [])];
    (voci().find((b) => b.classList.contains("scelta")) ?? voci()[0])?.focus();
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onAperto(false); ref.current?.querySelector<HTMLButtonElement>("button.chip")?.focus(); }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const b = voci(), i = b.indexOf(document.activeElement as HTMLButtonElement);
      b[(i + (e.key === "ArrowDown" ? 1 : b.length - 1)) % b.length]?.focus();
      e.preventDefault();
    };
    const fuori = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onAperto(false); };
    addEventListener("keydown", tasto);
    addEventListener("mousedown", fuori);
    return () => { removeEventListener("keydown", tasto); removeEventListener("mousedown", fuori); };
  }, [aperto]);
  return (
    <span ref={ref} className="chip-menu">
      <button type="button" className="chip" aria-haspopup="menu" aria-expanded={aperto} aria-label={etichetta} disabled={disabled} onClick={() => onAperto(!aperto)}>{chip}</button>
      {aperto && <div className={`menu-casella flottante ${lato}`} role="menu">{children}</div>}
    </span>
  );
}

/** Titolo di gruppo e voci con spunta a sinistra: la scelta in uso ha lo sfondo e la spunta. */
function ListaScelta({ titolo, voci, scelto, onScegli }: { titolo: string; voci: Scelta[]; scelto: string | null | undefined; onScegli(id: string): void }) {
  return (
    <div role="group" aria-label={titolo}>
      <div className="titolo-gruppo">{titolo}</div>
      {voci.map((v) => (
        <button key={v.id} type="button" role="menuitemradio" aria-checked={v.id === scelto} className={v.id === scelto ? "voce doppia scelta" : "voce doppia"} onClick={() => onScegli(v.id)}>
          <span className={v.id === scelto ? "spunta" : "spunta nascosta"}><Icona nome="spunta" colore="primaria" /></span>
          <span className="testi">
            <span className={`etichetta${v.pericolo ? " pericolo" : ""}`}>{v.etichetta}</span>
            {v.descrizione && <span className="descrizione">{v.descrizione}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

export function ChipPermessi({ s, p, imposta, aperto, onAperto, disabled }: Dati & { imposta: Imposta; aperto: boolean; onAperto(a: boolean): void; disabled: boolean }) {
  const id = permessiDi(s, p);
  return (
    <ChipMenu aperto={aperto} onAperto={onAperto} lato="sinistra" etichetta="Permessi" disabled={disabled}
      chip={<><Icona nome="mano" /><span className="etichetta">{PERMESSI.find((v) => v.id === id)!.etichetta}</span><Icona nome="giu" /></>}>
      <ListaScelta titolo="Permessi" voci={PERMESSI} scelto={id} onScegli={(permessi) => { onAperto(false); imposta({ permessi }); }} />
    </ChipMenu>
  );
}

/** Finestra di contesto della chat aperta (`contesto_max` del motore): la mette la chat, il chip la legge qui. */
export const ContestoMax = createContext<number | null>(null);

/** «62%» con il suggerimento «Contesto usato: 62%» al passaggio (`visibile` lo tiene aperto per la prova di parità). */
export function ChipContesto({ s, visibile }: { s: Dati["s"]; visibile: boolean }) {
  const percento = percentoContesto(s.contesto, useContext(ContestoMax));
  if (percento == null) return null;
  return (
    <span className={visibile ? "con-suggerimento sopra contesto visibile" : "con-suggerimento sopra contesto"}>
      <span className="chip" tabIndex={0} aria-label={`Contesto usato: ${percento}%`}><Icona nome="indicatore" /><span>{percento}%</span></span>
      <span className="suggerimento" role="tooltip">Contesto usato: {percento}%</span>
    </span>
  );
}

export function ChipModello({ s, p, imposta, aperto, onAperto, disabled }: Dati & { imposta: Imposta; aperto: boolean; onAperto(a: boolean): void; disabled: boolean }) {
  const modello = modelloDi(s, p), sforzo = sforzoDi(p), livello = SFORZI.findIndex((x) => x.id === sforzo.id);
  const nome = etichettaModello(modello) ?? nomeModello(modello ?? null);
  if (!nome) return null;
  return (
    <ChipMenu aperto={aperto} onAperto={onAperto} lato="destra" etichetta="Modello e sforzo" disabled={disabled}
      chip={<><span className="modello">{nome}</span><span className="livello">{sforzo.etichetta}</span><Icona nome="giu" /></>}>
      <ListaScelta titolo="Modello" voci={MODELLI_MENU} scelto={modello} onScegli={(id) => { onAperto(false); imposta({ modello: id }); }} />
      <div className="separatore"><div className="linea" /></div>
      <div className="titolo-gruppo">Sforzo</div>
      <div className="sforzo" role="radiogroup" aria-label="Sforzo">
        {SFORZI.map((x, i) => (
          <button key={x.id} type="button" role="radio" aria-checked={i === livello} className={i === livello ? "tacca scelta" : "tacca"} onClick={() => imposta({ sforzo: x.id === SFORZO_BASE ? null : x.id })}>
            <span className={i <= livello ? "barra piena" : "barra"} />
            <span className="livello">{x.etichetta}</span>
          </button>
        ))}
      </div>
      <div className="separatore"><div className="linea" /></div>
      <div className="riga-rapida">
        <Icona nome="fulmine" />
        <span className="etichetta">Modalità rapida</span>
        <Interruttore etichetta="Modalità rapida" acceso={p?.rapida === true} onCambia={(rapida) => imposta({ rapida: rapida || null })} />
      </div>
      <button type="button" role="menuitem" className="voce" onClick={() => { onAperto(false); imposta({ modello: null, sforzo: null, rapida: null }); }}>
        <Icona nome="reimposta" /><span className="etichetta">Reimposta predefiniti</span>
      </button>
    </ChipMenu>
  );
}

/** Dove le scelte della chat diventano preferenze della sessione (le legge #457 per `manda`). */
export const impostaDi = (chat: string): Imposta => (parte) => { void api().impostaPreferenze(chat, parte); };
