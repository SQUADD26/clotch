// figma: 148-28674 — «Selettore modello · Menu aperto» (148-28740 con «Impegno» a destra, 148-28806 «Modalità veloce»);
// 101-26140 — «chip permessi» 101:24819, «contesto» 101:24825 con «tooltip» 101:26425, «menu permessi» 101:26398;
// 101-26427 — «chip modello» 101:24829 (il menu 101:26707 è sostituito dai frame 148).
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { PreferenzeSessione, Sessione } from "../../tipi";
import { api } from "../base/dati";
import { Icona } from "../base/Icona";
import { Interruttore } from "../impostazioni/controlli";
import { comanda } from "./clotch-ai";
import { etichettaModello, impostazioneMotore, MODELLI_MENU, nomeModello, modelloDi, PERMESSI, permessiDi, percentoContesto, sforzoDi, SFORZI, SFORZO_BASE, type Scelta } from "./scelte";
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

/** Modello e impegno in un giro solo (148:28674): scegliere o passare su un modello apre «Impegno» a destra (148:28740); in fondo «Modalità veloce» (148:28806).
 *  Le scorciatoie 1-4 scelgono il modello. Il menu resta aperto dopo il modello; scegliere l'impegno lo chiude. `predefinito`: id del modello delle impostazioni. */
export function ChipModello({ s, p, imposta, aperto, onAperto, disabled, predefinito, impegnoAperto = false }: Dati & {
  imposta: Imposta; aperto: boolean; onAperto(a: boolean): void; disabled: boolean; predefinito?: string; impegnoAperto?: boolean;
}) {
  const modello = modelloDi(s, p), sforzo = sforzoDi(p), rapida = p?.rapida === true;
  const nome = etichettaModello(modello) ?? nomeModello(modello ?? null);
  const [impegno, setImpegno] = useState(impegnoAperto);
  const apri = (a: boolean) => { setImpegno(false); onAperto(a); };
  const scegliModello = (id: string) => { setImpegno(true); imposta({ modello: id }); };
  useEffect(() => {
    if (!aperto) return;
    const numero = (e: KeyboardEvent) => { const m = MODELLI_MENU[Number(e.key) - 1]; if (m && !e.metaKey && !e.ctrlKey && !e.altKey) scegliModello(m.id); };
    addEventListener("keydown", numero);
    return () => removeEventListener("keydown", numero);
  }, [aperto]);
  if (!nome) return null;
  return (
    <ChipMenu aperto={aperto} onAperto={apri} lato="destra" etichetta="Modello e impegno" disabled={disabled}
      chip={<>{rapida && <Icona nome="fulmine" colore="accento" />}<span className="modello">{nome}</span><span className="livello">{sforzo.etichetta}</span><Icona nome="giu" /></>}>
      <div role="group" aria-label="Modello">
        {MODELLI_MENU.map((m, i) => (
          <button key={m.id} type="button" role="menuitemradio" aria-checked={m.id === modello} className={m.id === modello ? "voce scelta" : "voce"}
            onClick={() => scegliModello(m.id)} onMouseEnter={() => setImpegno(true)} onKeyDown={() => setImpegno(true)}>
            <span className="testa"><span className="etichetta">{m.etichetta}</span>{m.id === predefinito && <span className="predefinito">Predefinito</span>}</span>
            {m.id === modello ? <Icona nome="spunta" /> : <span className="numero">{i + 1}</span>}
          </button>
        ))}
      </div>
      <div className="linea-menu" />
      <div className="titolo-gruppo">Modalità veloce</div>
      <div className="riga-veloce">
        <span className="testi"><span className="etichetta">Attiva la modalità veloce</span><span className="descrizione">Richiede crediti di utilizzo</span></span>
        <Interruttore etichetta="Modalità veloce" acceso={rapida} onCambia={(r) => imposta({ rapida: r || null })} />
      </div>
      {impegno && (
        <div className="menu-casella impegno" role="group" aria-label="Impegno">
          <div className="titolo-gruppo">Impegno</div>
          {SFORZI.map((x) => (
            <button key={x.id} type="button" role="menuitemradio" aria-checked={x.id === sforzo.id} className="voce" onClick={() => { apri(false); imposta({ sforzo: x.id === SFORZO_BASE ? null : x.id }); }}>
              <span className="testa"><span className="etichetta">{x.etichetta}</span></span>
              {x.id === sforzo.id && <Icona nome="spunta" />}
            </button>
          ))}
        </div>
      )}
    </ChipMenu>
  );
}

/** Dove le scelte della chat diventano preferenze della sessione (le legge #457 per `manda`); modello, impegno e modalità veloce vanno subito anche al motore
 *  (`sessione_imposta`, vale dal prossimo messaggio): un rifiuto, come con la sessione al lavoro, finisce nell'avviso di `comanda`. */
export const impostaDi = (chat: string): Imposta => (parte) => {
  void api().impostaPreferenze(chat, parte);
  const motore = impostazioneMotore(parte);
  if (motore) void comanda("sessione_imposta", { chat, ...motore });
};
