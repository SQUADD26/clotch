// figma: 101-26140 — «chip permessi» 101:24819, «contesto» 101:24825 con «tooltip» 101:26425, «menu permessi» 101:26398;
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { PreferenzeSessione, Sessione } from "../../tipi";
import { api } from "../base/dati";
import { Icona } from "../base/Icona";
import { Sovrapposto } from "../base/Sovrapposto";
import { Suggerimento } from "../base/Suggerimento";
import { numero } from "../base/token";
import { comanda } from "./clotch-ai";
import { impostazioneMotore, PERMESSI, permessiDi, percentoContesto, type Scelta } from "./scelte";
import "./scelte.css";

/** `base`: l'impegno predefinito del modello, se non è quello di tutti (`sforzo_default` del catalogo). */
export type Imposta = (parte: Partial<{ [K in keyof PreferenzeSessione]: PreferenzeSessione[K] | null }>, base?: string) => void;
export type Dati = { s: Pick<Sessione, "modello" | "permessi" | "contesto">; p?: PreferenzeSessione };

/** Il nome di un controllo della casella, appoggiato sopra come «Contesto usato» (101:26425): lo stesso suggerimento per tutti, al posto del `title` del sistema. */
export function NomeSopra({ testo, children }: { testo: string; children: ReactNode }) {
  return <Suggerimento testo={testo} classe="suggerimento" lato="sopra" allinea="centro" scarto={numero("spazio-3") + numero("spazio-0-5")}>{children}</Suggerimento>;
}

/** Un chip che apre il suo menu sopra di sé (base/Sovrapposto: Esc o un clic fuori lo chiudono, il fuoco torna al chip); le frecce passano da una voce all'altra. */
export function ChipMenu({ aperto, onAperto, lato, etichetta, disabled, chip, children }: {
  aperto: boolean; onAperto(a: boolean): void; lato: "sinistra" | "destra"; etichetta: string; disabled?: boolean; chip: ReactNode; children: ReactNode;
}) {
  const [menu, setMenu] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menu) return;
    const voci = () => [...menu.querySelectorAll<HTMLButtonElement>("button")];
    (voci().find((b) => b.classList.contains("scelta")) ?? voci()[0])?.focus();
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "Tab") { onAperto(false); e.preventDefault(); return; } // il menu si chiude e il fuoco torna al chip
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const b = voci(), i = b.indexOf(document.activeElement as HTMLButtonElement);
      b[(i + (e.key === "ArrowDown" ? 1 : b.length - 1)) % b.length]?.focus();
      e.preventDefault();
    };
    menu.addEventListener("keydown", tasto);
    return () => menu.removeEventListener("keydown", tasto);
  }, [menu]);
  return (
    <span className="chip-menu">
      <NomeSopra testo={etichetta}>
        <button type="button" className="chip" aria-haspopup="menu" aria-expanded={aperto} aria-label={etichetta} disabled={disabled} onClick={() => onAperto(!aperto)}>{chip}</button>
      </NomeSopra>
      {aperto && (
        <Sovrapposto lato="sopra" fine={lato === "destra"} scarto={numero(lato === "destra" ? "spazio-1" : "spazio-2")} className={`menu-casella flottante ${lato}`} role="menu"
          rif={setMenu} onChiudi={() => onAperto(false)}>{children}</Sovrapposto>
      )}
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
    <Suggerimento testo={`Contesto usato: ${percento}%`} classe="suggerimento" lato="sopra" allinea="centro" scarto={numero("spazio-3") + numero("spazio-0-5")} forzato={visibile}>
      <span className="chip" tabIndex={0} aria-label={`Contesto usato: ${percento}%`}><Icona nome="indicatore" /><span>{percento}%</span></span>
    </Suggerimento>
  );
}

/** Dove le scelte della chat diventano preferenze della sessione (le legge #457 per `manda`); modello, impegno e modalità veloce vanno subito anche al motore
 *  (`sessione_imposta`, vale dal prossimo messaggio): un rifiuto, come con la sessione al lavoro, finisce nell'avviso di `comanda`. */
export const impostaDi = (chat: string): Imposta => (parte, base) => {
  void api().impostaPreferenze(chat, parte);
  const motore = impostazioneMotore(parte, base);
  if (motore) void comanda("sessione_imposta", { chat, ...motore });
};
