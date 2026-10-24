// figma: 148-51982 — «Nuova sessione»: intestazione 148:52165, casella del primo messaggio e selettori Ambiente, Cartella, Ramo, Worktree.
// Menu ambiente 148:52243, cartella 148:52543, ramo 148:52864; worktree spento 148:53138; cartella senza git 148:53399; finestra stretta 148:53655.
// Invio manda `nuova_sessione`; il motore risponde a sessione nata (fino a ~1 minuto) con il suo id e si apre quella.
// Se modello o sforzo partono diversi, il motore scrive dopo un `errore` per lo stesso comando: si mostra nell'avviso.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { CartellaAvvio, ContestoCartella, NuovaSessioneApi, PreferenzeSessione } from "../../tipi";
import { Bottone, BottoneIcona } from "../base/Bottone";
import { Dialogo } from "../base/Dialogo";
import { avvisa } from "../base/Avvisi";
import { useChiamata } from "../base/dati";
import { Icona } from "../base/Icona";
import { useNavigazione } from "../base/navigazione";
import { useApriSessione } from "../barra/apri";
import { accountScelto } from "../barra/account-dati";
import { useImpostazioni } from "../impostazioni/stato";
import { argsNuovaSessione, LOCALE, nomeAmbiente, notaAvvio, type Ambiente } from "./avvio";
import { ChipPermessi } from "./Chip";
import { ChipModello } from "./ChipModello";
import { daPiano } from "../clotch-ai/registro";
import { comandaEsito } from "./clotch-ai";
import { Selettore, MenuAmbiente, MenuCartella, MenuRamo } from "./MenuAvvio";
import type { Macchina, Proposta } from "../../macchine-tipi";
import { DialogoMacchina } from "./DialogoMacchina";
import { etichettaPasso, motivoGuasto } from "./macchine";
import { useMacchine } from "./usaMacchine";
import { modelloDi, sforzoDi } from "./scelte";
import { erroreComando, idModello, provaDi } from "./testi";
import "./casella.css";
import "./nuova-sessione.css";
import "./macchine.css";

declare global {
  interface Window { nuovaSessione: NuovaSessioneApi }
}

const ATTESA_MS = 60_000; // `ok` senza id di sessione: la casella si libera dopo un minuto
const ERRORE_DOPO_MS = 120_000; // quanto si resta in ascolto dell'`errore` che il motore scrive dopo `ok`
const SENZA_GIT: ContestoCartella = { git: false, rami: [], predefinito: null };
// shortcut: di una macchina SSH non si leggono i rami (il main non ha ssh): si parte da «dev» come il disegno 149:69953; il motore rifiuta col perché se manca
const REMOTO: ContestoCartella = { git: true, rami: [], predefinito: "dev" };

export function IntestazioneNuovaSessione() {
  return <div className="intestazione"><div className="testi"><span className="titolo">Nuova sessione</span></div></div>;
}

/** «modello letto …, chiesto …»: l'`errore` che il motore scrive dopo `ok` per lo stesso comando; arriva quando la vista è già chiusa, quindi l'avviso è dell'app. */
function guardaErrore(comando: string) {
  const t = setTimeout(() => off(), ERRORE_DOPO_MS);
  const off = window.clotchAi.onRegistro((r) => {
    const x = daPiano(r).esiti.get(comando);
    if (x?.esito !== "errore") return;
    off(); clearTimeout(t);
    avvisa({ tipo: "errore", messaggio: x.testo || "La sessione è partita con modello o sforzo diversi da quelli chiesti" });
  });
}

type Menu = "ambiente" | "cartella" | "ramo" | "permessi" | "modello" | null;
type Dialogo = { tipo: "aggiungi"; proposta?: Proposta | null; macchina?: Macchina | null } | { tipo: "togli"; nome: string } | null;

export function NuovaSessione() {
  const { sezione } = useNavigazione();
  const apriSessione = useApriSessione();
  const { modello: globale } = useImpostazioni();
  const dati = useChiamata(() => window.nuovaSessione.cartelle(), []).dati;
  const mac = useMacchine();
  const [menu, setMenu] = useState<Menu>(() => { const m = provaDi(sezione, "menu"); return m === "ssh" ? "ambiente" : m === "ambiente" || m === "cartella" || m === "ramo" ? m : null; });
  const [ambiente, setAmbiente] = useState<Ambiente>(() => { const a = provaDi(sezione, "ambiente"); return a ? { tipo: "ssh", host: a } : LOCALE; });
  const [dialogo, setDialogo] = useState<Dialogo>(() => { const d = provaDi(sezione, "dialogo"), r = provaDi(sezione, "rimuovi"); return r ? { tipo: "togli", nome: r } : d ? { tipo: "aggiungi" } : null; });
  const [scelta, setScelta] = useState<CartellaAvvio | null | undefined>(undefined); // undefined = ancora la prima dei recenti
  const [ramoScelto, setRamo] = useState<string | null>(null);
  const [worktree, setWorktree] = useState(() => provaDi(sezione, "worktree") !== "spento");
  const [p, setP] = useState<PreferenzeSessione>({});
  const [testo, setTesto] = useState(() => provaDi(sezione, "testo") ?? "");
  const [attesa, setAttesa] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const recenti = dati?.recenti ?? [];
  const cartellaLocale = scelta !== undefined ? scelta : recenti.find((c) => c.nome === provaDi(sezione, "cartella")) ?? recenti[0] ?? null;
  const elencoMenu = cartellaLocale && !recenti.some((c) => c.percorso === cartellaLocale.percorso) ? [cartellaLocale, ...recenti] : recenti;
  const locale = ambiente.tipo === "locale", remoto = ambiente.tipo === "ssh";
  const macchina = remoto ? mac.macchine.find((m) => m.nome === ambiente.host) ?? null : null;
  const daFinire = macchina?.stato === "da_completare", bloccata = remoto && macchina?.stato !== "pronta"; // una macchina da completare non apre sessioni
  const cartella = remoto ? (macchina ? { percorso: macchina.cartella, nome: macchina.cartella } : null) : cartellaLocale;
  const [ctx, setCtx] = useState<{ percorso: string; c: ContestoCartella } | null>(null);
  useEffect(() => {
    if (!cartella || !locale) return;
    let vivo = true;
    window.nuovaSessione.contesto(cartella.percorso).then((c) => vivo && setCtx({ percorso: cartella.percorso, c }), () => vivo && setCtx({ percorso: cartella.percorso, c: SENZA_GIT }));
    return () => { vivo = false; };
  }, [cartella?.percorso, locale]);
  const contesto = remoto ? REMOTO : cartella && locale && ctx?.percorso === cartella.percorso ? ctx.c : null; // null = ancora in lettura
  const ramo = ramoScelto ?? contesto?.predefinito ?? null;
  const senzaGit = !!contesto && !contesto.git;
  const conGit = !!contesto?.git;

  useLayoutEffect(() => { const a = area.current; if (a) { a.style.height = "auto"; a.style.height = `${a.scrollHeight}px`; } }, [testo]);

  const imposta = (parte: Partial<{ [K in keyof PreferenzeSessione]: PreferenzeSessione[K] | null }>) => setP((x) => ({ ...x, ...parte }) as PreferenzeSessione);
  const modello = modelloDi({ modello: idModello(globale) ?? null }, p) ?? "";
  const pronto = !!testo.trim() && !attesa && (!cartella || !locale || !!contesto) && !bloccata;
  const manda = async () => {
    if (!pronto || !dati) return;
    setAttesa(true);
    const e = await comandaEsito("nuova_sessione", argsNuovaSessione({ ambiente, cartella: cartella?.percorso ?? dati.casa, prompt: testo.trim(), modello, sforzo: sforzoDi(p).id,
      account: accountScelto.leggi(), git: conGit ? { ramo, worktree } : null }));
    if (e?.esito !== "ok") {
      setAttesa(false);
      // il motore dice il perché (cartella che non c'è, ramo, lock occupato…); riprovare serve solo se non l'ha rifiutato
      avvisa({ tipo: "errore", messaggio: (e && (e.esito === "rifiutato" || e.esito === "errore") && e.testo) || erroreComando(e), azione: e?.esito === "rifiutato" ? undefined : { etichetta: "Riprova", fai: () => void manda() } });
      return;
    }
    guardaErrore(e.id);
    if (e.sessione) void apriSessione(e.sessione);
    else setTimeout(() => { setAttesa(false); setTesto(""); }, ATTESA_MS);
  };
  const tasti = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void manda();
  };
  const apriCartella = async () => { const c = await window.nuovaSessione.scegliCartella().catch(() => null); if (c) { setScelta(c); setRamo(null); } };
  const togli = async (nome: string) => {
    setDialogo(null);
    const e = await comandaEsito("macchina_togli", { nome });
    if (e?.esito === "ok") { if (ambiente.host === nome) setAmbiente(LOCALE); } else avvisa({ tipo: "errore", messaggio: motivoGuasto(e) });
    mac.ricarica();
  };
  const apri = (m: Menu) => setMenu(menu === m ? null : m);
  const chiudi = () => setMenu(null);

  return (
    <div className="nuova-sessione">
      <div className="nuova-corpo">
        <div className="area-casella con-menu">
          <div className={`casella ${!testo ? "vuota" : bloccata ? "disabilitata" : "scritta"}${menu === "permessi" || menu === "modello" ? " fuoco" : ""}`}>
            <div className="area-testo">
              <textarea ref={area} rows={1} value={testo} disabled={!!attesa} autoFocus={!sezione} onChange={(e) => setTesto(e.target.value)} onKeyDown={tasti}
                placeholder="Scrivi il primo messaggio" aria-label="Scrivi il primo messaggio" />
            </div>
            <div className="azioni">
              <BottoneIcona icona="piu" etichetta="Allega" disabled />
              <ChipPermessi s={{ modello, permessi: null, contesto: null }} p={p} imposta={imposta} aperto={menu === "permessi"} onAperto={(a) => setMenu(a ? "permessi" : null)} disabled={!!attesa} />
              <span className="spinta" />
              <ChipModello s={{ modello, permessi: null, contesto: null }} p={p} imposta={imposta} aperto={menu === "modello"} onAperto={(a) => setMenu(a ? "modello" : null)} disabled={!!attesa} />
              <BottoneIcona icona="microfono" etichetta="Detta" disabled />
              <button type="button" className="bottone-invia" disabled={!pronto} aria-label={attesa ? "In attesa della sessione" : "Invia"} title={attesa ? "In attesa della sessione" : "Invia"} onClick={() => void manda()}>
                {attesa ? <Icona nome="spinner" gira colore="su-accento" /> : <Icona nome="invia" colore={testo && !bloccata ? "su-accento" : "terziaria"} />}
              </button>
            </div>
          </div>
        </div>
        <div className="selettori-avvio">
          <Selettore icona={daFinire ? "avviso" : "computer"} avviso={daFinire} etichetta={nomeAmbiente(ambiente)} aperto={menu === "ambiente"} onClick={() => apri("ambiente")}>
            {menu === "ambiente" && <MenuAmbiente ambiente={ambiente} mac={mac} ssh={provaDi(sezione, "menu") === "ssh"} mostraBase={provaDi(sezione, "suggerimento")} onScegli={setAmbiente}
              onAggiungi={(proposta) => setDialogo({ tipo: "aggiungi", proposta })} onTogli={(m) => setDialogo({ tipo: "togli", nome: m.nome })} onChiudi={chiudi} />}
          </Selettore>
          <Selettore icona="cartella" etichetta={cartella?.nome ?? "Nessuna cartella"} aperto={menu === "cartella"} fisso={remoto} stato={senzaGit ? "errore" : undefined} onClick={() => apri("cartella")}>
            {menu === "cartella" && <MenuCartella recenti={elencoMenu} cartella={cartella} ctx={contesto} ramo={ramo} worktree={worktree} inizio={provaDi(sezione, "cerca-cartella") ?? ""}
              onCartella={(c) => { setScelta(c); setRamo(null); }} onApri={() => void apriCartella()} onRamo={() => setMenu("ramo")} onWorktree={setWorktree} onChiudi={chiudi} />}
          </Selettore>
          {conGit && (
            <>
              <Selettore icona="ramo" etichetta={ramo ?? "Nessun ramo"} aperto={menu === "ramo"} fisso={remoto} onClick={() => apri("ramo")}>
                {menu === "ramo" && <MenuRamo rami={contesto.rami} ramo={ramo} inizio={provaDi(sezione, "cerca") ?? ""} onScegli={setRamo} onChiudi={chiudi} />}
              </Selettore>
              <Selettore icona="strati" etichetta={worktree ? "Worktree" : "Senza worktree"} stato={worktree ? undefined : "spento"} onClick={() => setWorktree(!worktree)} />
            </>
          )}
        </div>
        {conGit && cartella && !daFinire && <span className="nota-avvio">{notaAvvio(worktree, ramo, cartella.nome)}</span>}
        {macchina && daFinire && (
          <div className="riga-avviso-macchina">
            <Icona nome="avviso" colore="lavoro" />
            <span className="motivo">{macchina.nome} non è pronta{macchina.passo ? `: la preparazione si è fermata a ${etichettaPasso(macchina.passo)}` : ""}.</span>
            <Bottone tipo="secondario" onClick={() => setDialogo({ tipo: "aggiungi", macchina })}>Completa la preparazione</Bottone>
          </div>
        )}
        {senzaGit && cartella && (
          <div className="avviso-avvio" role="alert">
            <Icona nome="avviso" colore="errore" />
            <div className="testi">
              <span className="titolo">«{cartella.nome}» non è un repo git</span>
              <span className="corpo">Ramo e worktree non sono disponibili. Scegli un’altra cartella o scrivi qui.</span>
            </div>
          </div>
        )}
      </div>
      {dialogo?.tipo === "aggiungi" && !(provaDi(sezione, "dialogo") && mac.carica) && (
        <DialogoMacchina proposte={mac.proposte} proposta={dialogo.proposta ?? (provaDi(sezione, "dialogo") && provaDi(sezione, "dialogo") !== "vuoto" ? mac.proposte[0] : null)}
          macchina={dialogo.macchina} prova={provaDi(sezione, "dialogo")} onFatto={mac.ricarica}
          onChiudi={() => { setDialogo(null); mac.ricarica(); }} onNuovaSessione={(nome) => { setAmbiente({ tipo: "ssh", host: nome }); setDialogo(null); mac.ricarica(); }} />
      )}
      {dialogo?.tipo === "togli" && (
        <Dialogo centrato titolo={`Rimuovere ${dialogo.nome}?`} corpo={`Clotch non apre più sessioni su ${dialogo.nome}. I file sulla macchina restano.`} onChiudi={() => setDialogo(null)}
          bottoni={<><Bottone tipo="secondario" data-fuoco onClick={() => setDialogo(null)}>Annulla</Bottone><Bottone tipo="pericolo" onClick={() => void togli(dialogo.nome)}>Rimuovi</Bottone></>} />
      )}
    </div>
  );
}
