// figma: 148-28674 — «Selettore modello · Menu aperto» (148-28740 con «Impegno» a destra, 148-28806 «Modalità veloce»); chip modello 101:24829.
import { useEffect, useState, type KeyboardEvent as TastoReact } from "react";
import type { ModelloMotore } from "../../tipi";
import { api } from "../base/dati";
import { Icona } from "../base/Icona";
import { Sovrapposto } from "../base/Sovrapposto";
import { numero as misura } from "../base/token";
import { Interruttore } from "../impostazioni/controlli";
import { ChipMenu, type Dati, type Imposta } from "./Chip";
import { haRapida, modelliMenu, modelloDi, nomeModello, etichettaModello, sforziDi, sforzoDi, SFORZO_BASE, voceCatalogo, type Scelta } from "./scelte";

/** Modello e impegno in un giro solo (148:28674): scegliere o passare su un modello apre il suo «Impegno» a destra (148:28740), e scegliere l'impegno sceglie anche il modello;
 *  in fondo «Modalità veloce» (148:28806). Le scorciatoie 1-4 scelgono il modello. Dal catalogo del motore (`modelli.json`): modelli, impegni di ogni modello (`[]` = nessun
 *  «Impegno»), interruttore veloce solo se `rapida`, impegno predefinito `sforzo_default`, «Altri modelli» oltre ai quattro principali; senza catalogo vale la lista fissa.
 *  `predefinito`: id del modello delle impostazioni. */
export function ChipModello({ s, p, imposta, aperto, onAperto, disabled, predefinito, impegnoAperto = false }: Dati & {
  imposta: Imposta; aperto: boolean; onAperto(a: boolean): void; disabled: boolean; predefinito?: string; impegnoAperto?: boolean;
}) {
  const [cat, setCat] = useState<ModelloMotore[] | null>(null);
  useEffect(() => { void api().modelli().then(setCat, () => setCat(null)); }, [aperto]);
  const modello = modelloDi(s, p), base = (id: string | null | undefined) => voceCatalogo(cat, id)?.sforzo_default ?? SFORZO_BASE;
  const sforzo = sforzoDi(p, base(modello)), rapida = p?.rapida === true && haRapida(cat, modello), conImpegno = sforziDi(cat, modello).length > 0;
  const nome = etichettaModello(modello) ?? nomeModello(modello ?? null);
  const { principali, altri } = modelliMenu(cat);
  const [impegno, setImpegno] = useState(impegnoAperto), [anteprima, setAnteprima] = useState<string | null>(null), [altriAperti, setAltriAperti] = useState(false);
  const mostrato = anteprima ?? modello, sforzi = sforziDi(cat, mostrato);
  const apri = (a: boolean) => { setImpegno(false); setAnteprima(null); setAltriAperti(false); onAperto(a); };
  const scegliModello = (id: string) => { setImpegno(true); setAnteprima(id); imposta({ modello: id }); };
  useEffect(() => {
    if (!aperto) return;
    const numero = (e: KeyboardEvent) => { const m = principali[Number(e.key) - 1]; if (m && !e.metaKey && !e.ctrlKey && !e.altKey) scegliModello(m.id); };
    addEventListener("keydown", numero);
    return () => removeEventListener("keydown", numero);
  }, [aperto, cat]);
  if (!nome) return null;
  /** Frecce dentro «Impegno»: su e giù tra le voci, ← torna al modello. */
  const frecce = (e: TastoReact<HTMLElement>, modello: () => HTMLElement | null) => {
    const b = [...e.currentTarget.querySelectorAll<HTMLElement>("button")], i = b.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowLeft") modello()?.focus();
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") b[(i + (e.key === "ArrowDown" ? 1 : b.length - 1)) % b.length]?.focus();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  const voce = (m: Scelta, numero?: number) => (
    <button key={m.id} type="button" role="menuitemradio" aria-checked={m.id === modello} className={m.id === modello ? "voce scelta" : "voce"}
      onClick={() => scegliModello(m.id)} onMouseEnter={() => { setImpegno(true); setAnteprima(m.id); }} onFocus={() => setAnteprima(m.id)} onKeyDown={(e) => { if (e.key === "ArrowRight") { setImpegno(true); setTimeout(() => document.querySelector<HTMLElement>(".sovrapposto.impegno button")?.focus()); } }}>
      <span className="testa"><span className="etichetta">{m.etichetta}</span>{m.id === predefinito && <span className="predefinito">Predefinito</span>}</span>
      {m.id === modello ? <Icona nome="spunta" /> : numero ? <span className="numero">{numero}</span> : null}
    </button>
  );
  return (
    <ChipMenu aperto={aperto} onAperto={apri} lato="destra" etichetta="Modello e impegno" disabled={disabled}
      chip={<>{rapida && <Icona nome="fulmine" colore="accento" />}<span className="modello">{nome}</span>{conImpegno && <span className="livello">{sforzo.etichetta}</span>}<Icona nome="giu" /></>}>
      <div role="group" aria-label="Modello">{principali.map((m, i) => voce(m, i + 1))}</div>
      {altri.length > 0 && (
        <>
          <div className="linea-menu" />
          <button type="button" role="menuitem" className="voce" aria-expanded={altriAperti} onClick={() => setAltriAperti(!altriAperti)}>
            <span className="testa"><span className="etichetta">Altri modelli</span></span><Icona nome={altriAperti ? "giu" : "destra"} />
          </button>
          {altriAperti && <div role="group" aria-label="Altri modelli">{altri.map((m) => voce(m))}</div>}
        </>
      )}
      {haRapida(cat, modello) && (
        <>
          <div className="linea-menu" />
          <div className="titolo-gruppo">Modalità veloce</div>
          <div className="riga-veloce">
            <span className="testi"><span className="etichetta">Attiva la modalità veloce</span><span className="descrizione">Richiede crediti di utilizzo</span></span>
            <Interruttore etichetta="Modalità veloce" acceso={p?.rapida === true} onCambia={(r) => imposta({ rapida: r || null })} />
          </div>
        </>
      )}
      {impegno && sforzi.length > 0 && (
        // a destra del menu, in cima; a sinistra se a destra non c'è posto (base/Sovrapposto); ← torna al modello
        <Sovrapposto lato="destra" scarto={misura("spazio-1")} className="menu-casella impegno" role="group" label="Impegno" onChiudi={() => setImpegno(false)}>
          <div onKeyDown={(e) => frecce(e, () => document.querySelector<HTMLElement>(".menu-casella.flottante.destra button.scelta, .menu-casella.flottante.destra button"))}>
          <div className="titolo-gruppo">Impegno</div>
          {sforzi.map((x) => {
            const scelto = x.id === sforzoDi(p, base(mostrato)).id; // l'impegno scelto vale per ogni modello
            return (
              <button key={x.id} type="button" role="menuitemradio" aria-checked={scelto} className="voce"
                onClick={() => { apri(false); imposta({ ...(mostrato !== modello ? { modello: mostrato } : {}), sforzo: x.id === base(mostrato) ? null : x.id }, base(mostrato)); }}>
                <span className="testa"><span className="etichetta">{x.etichetta}</span></span>
                {scelto && <Icona nome="spunta" />}
              </button>
            );
          })}
          </div>
        </Sovrapposto>
      )}
    </ChipMenu>
  );
}
