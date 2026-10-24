// figma: 101-37879 — «comandi globali» della barra del titolo: luna di Non disturbare (menu 101-38626, con Clotch 101-50008,
// senza 101-50071, attivo 101-38897) e «Ferma tutto» (conferma 101-37696, in corso 101-37879, fatto 101-38124, errore 101-38374).
import { useCallback, useEffect, useRef } from "react";
import { acceso as clotchAcceso } from "../pannello/clotch";
import { aggiornaAvviso, avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { Dialogo } from "../base/Dialogo";
import { Icona, type NomeIcona } from "../base/Icona";
import "../base/menu.css"; // stile di «menu» della base: qui il menu ha titolo e nota, che Menu non ha
import { useAvvisoNotch } from "./avvisoNotch";
import { useEscChiude } from "../base/layout";
import { useNavigazione } from "../base/navigazione";
import { avviaClotchAi, clotchAi, negozio, useRegistro } from "./dati";
import { plurale } from "./Intestazione";
import { sessioniAlLavoro, statoClotchAi } from "./vista";
import { Sovrapposto } from "../base/Sovrapposto";

// Ore fisse del disegno: «Fino alle 18:00»; «Fino a domani mattina» = domani alle 8:00 (decisione della master, #352).
const ORA_SERA = 18, ORA_MATTINA = 8;
const prossima = (ora: number, h: number, domani = false) => {
  const d = new Date(ora); d.setHours(h, 0, 0, 0);
  if (domani || d.getTime() <= ora) d.setDate(d.getDate() + 1);
  return d.toISOString();
};

/** Stato di Ferma tutto che il registro non ha ancora: la conferma aperta e il comando in volo. */
export const fermo = negozio<"chiuso" | "conferma" | "in-corso">("chiuso");

/** Menu di Non disturbare aperto (anche dalla scena di prova 101-38626). */
export const menuQuiete = negozio(false);

export const avvisoInCorso = (quante: number) => avvisa({ tipo: "caricamento", messaggio: `Fermo ${plurale(quante, "sessione", "sessioni")}…` });

/** Esito di Ferma tutto: `non` = sessioni non ferme (null = clotch AI non ha risposto, col suo testo). */
export function esitoFermo(id: number, quante: number, non: string[] | null, testo = "") {
  if (non && !non.length) {
    aggiornaAvviso(id, { tipo: "info", messaggio: `${plurale(quante, "sessione ferma", "sessioni ferme")}`, azione: { etichetta: "Riprendi tutte", fai: () => clotchAi().comando("riprendi_tutto") } });
  } else {
    const messaggio = non ? (non.length === 1 ? "1 sessione non si è fermata" : `${non.length} sessioni non si sono fermate`) : testo || "clotch AI non risponde";
    aggiornaAvviso(id, { tipo: "errore", messaggio, azione: { etichetta: "Riprova", fai: () => fermaTutto(quante) } });
  }
}

export async function fermaTutto(quante: number) {
  fermo.metti("in-corso");
  const id = avvisoInCorso(quante);
  const e = await clotchAi().comando("ferma_tutto").catch(() => ({ esito: "errore", nonFermate: undefined, testo: "Non so se le sessioni si sono fermate: controlla" }));
  fermo.metti("chiuso");
  esitoFermo(id, quante, e.esito === "ok" ? e.nonFermate ?? [] : null, e.testo);
}

/** La durata scelta l'ultima volta (la spunta del menu da attivo); il registro conosce solo l'ora di fine. */
const scelta = negozio("");

function MenuNonDisturbare({ clotch, quiete, onChiudi }: { clotch: boolean; quiete: boolean; onChiudi(): void }) {
  const attuale = scelta.usa();
  const metti = (etichetta: string, args: Record<string, unknown>) => { scelta.metti(etichetta); onChiudi(); clotchAi().comando("non_disturbare", { acceso: true, ...args }); };
  const voci: [NomeIcona, string, Record<string, unknown>][] = [
    ["orologio", "Per 1 ora", { minuti: 60 }],
    ["orologio", `Fino alle ${ORA_SERA}:00`, { fino: prossima(Date.now(), ORA_SERA) }],
    ["luna", "Fino a domani mattina", { fino: prossima(Date.now(), ORA_MATTINA, true) }],
    ["nascondi", "Finché non lo tolgo", { fino: null }],
  ];
  return (
    <Sovrapposto fine className="menu" role="menu" onChiudi={onChiudi}>
      <div className="titolo-menu t-xs medio secondario">Non disturbare</div>
      {voci.map(([icona, etichetta, args]) => (
        <button key={etichetta} type="button" role="menuitemradio" aria-checked={quiete && attuale === etichetta} className="voce" onClick={() => metti(etichetta, args)}>
          <Icona nome={icona} />
          <span className="etichetta t-sm">{etichetta}</span>
          {quiete && attuale === etichetta && <Icona nome="spunta" colore="primaria" />}
        </button>
      ))}
      {quiete && (
        <button type="button" role="menuitem" className="voce" onClick={() => { scelta.metti(""); onChiudi(); clotchAi().comando("non_disturbare", { acceso: false }); }}>
          <Icona nome="chiudi" />
          <span className="etichetta t-sm">Togli</span>
        </button>
      )}
      <div className="separatore" role="separator"><div className="linea" /></div>
      <div className="nota-menu t-sm secondario">
        {clotch ? "Vale anche per Clotch: niente voce né microfono." : "clotch AI continua a lavorare e tiene gli avvisi per dopo."}
      </div>
    </Sovrapposto>
  );
}

export function ComandiTitolo() {
  const { dati: r } = useRegistro();
  useAvvisoNotch(); // sempre montato, in ogni vista: il toast «Avviso mandato anche al notch» (101-48368)
  const sessione = useNavigazione().vista === "sessione"; // i frame della sessione aperta (101-8036, 101-49632) non hanno i comandi globali di clotch AI
  const stato = fermo.usa();
  const menu = menuQuiete.usa();
  const chiudi = useCallback(() => menuQuiete.metti(false), []);
  useEscChiude(menu, chiudi);
  const quiete = !!r && statoClotchAi(r, Date.now()).stato === "pausa";
  const quante = r ? sessioniAlLavoro(r) : 0;
  // «L’app prova a riaprirla» (101-42000): una volta per chiusura, mai dopo `spegni` (evento friday «stop») // nome del protocollo del motore
  // Mai se le impostazioni di clotch AI dicono spenta; all'apertura, senza nessun evento ma con `attiva` vero, la accende («Avvio…»).
  const riaperta = useRef<number | null>(null);
  const attiva = r?.impostazioni?.attiva;
  const chiusa = !!r && statoClotchAi(r, Date.now()).stato === "spenta" && (r.clotchAi ? r.clotchAi.evento !== "stop" && attiva !== false : attiva === true);
  useEffect(() => {
    const t = r?.clotchAi?.t ?? 0;
    if (!chiusa || riaperta.current === t || new URLSearchParams(location.search).has("parita")) return;
    riaperta.current = t;
    avviaClotchAi(r!.clotchAi ? "riavvio" : "avvio");
  }, [chiusa]); // eslint-disable-line react-hooks/exhaustive-deps
  if (sessione) return null;
  return (
    <div className="comandi-titolo">
      <span className="ancora-menu">
      <button type="button" aria-label="Non disturbare" title={quiete ? "Non disturbare: attivo" : "Non disturbare"} aria-expanded={menu} aria-pressed={quiete}
        className={`bottone-icona ${menu || quiete ? "aperto" : ""}`} onClick={() => menuQuiete.metti(!menu)}>
        <Icona nome="luna" colore={quiete ? "accento" : "secondaria"} />
      </button>
      {menu && <MenuNonDisturbare clotch={!!r && clotchAcceso(r, Date.now())} quiete={quiete} onChiudi={chiudi} />}
      </span>
      <Bottone tipo="pericolo" piccolo disabled={stato === "in-corso" || !quante} title={quante ? undefined : "Nessuna sessione al lavoro"} onClick={() => fermo.metti("conferma")}>
        {stato === "in-corso" ? "Fermo…" : "Ferma tutto"}
      </Bottone>
      {stato === "conferma" && (
        <Dialogo titolo="Fermare tutte le sessioni?" onChiudi={() => fermo.metti("chiuso")}
          corpo={`${quante === 1 ? "La sessione al lavoro si ferma" : `Le ${quante} sessioni al lavoro si fermano`} subito. Le riprendi una per una o tutte insieme.`}
          bottoni={<>
            <Bottone tipo="secondario" onClick={() => fermo.metti("chiuso")}>Annulla</Bottone>
            <Bottone tipo="pericolo" onClick={() => fermaTutto(quante)}>Ferma tutto</Bottone>
          </>} />
      )}
    </div>
  );
}
