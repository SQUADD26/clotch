// figma: 149-67536 — «Aggiungi macchina» (vuoto 149:67536, da proposta 149:67568, nome non valido 149:67600), poi «Preparazione» dal vivo (149:67632, passo fallito 149:67664,
// login mancante 149:67696, pronta 149:67728, ripresa 149:69985, collega GitHub 149:70649). Nessun «Chiudi» finché il motore lavora: la preparazione dura fino a ~3 minuti.
import { useRef, useState } from "react";
import type { Macchina, Proposta } from "../../macchine-tipi";
import type { EsitoComando } from "../../comandi";
import { Bottone } from "../base/Bottone";
import { Dialogo } from "../base/Dialogo";
import { useRegistro } from "../clotch-ai/dati";
import { comandaEsito } from "./clotch-ai";
import { daProposta, FormMacchina, mancano, VUOTI, type ValoriMacchina } from "./FormMacchina";
import { motivoGuasto, passiDi, passoFermo, righePassi } from "./macchine";
import { AvvisoPasso, BloccoCodice, BloccoComando, chiedeMano, Passi } from "./PassiMacchina";
import "./macchine.css";

/** Gli argomenti di `macchina_aggiungi`: lo stesso comando, rimandato, riprende dal passo fallito. */
export const argomentiAggiungi = (v: ValoriMacchina) => ({
  nome: v.nome, cartella: v.cartella.trim(), host: v.host.trim(), ...(v.porta ? { porta: Number(v.porta) } : {}),
  ...(v.utente.trim() ? { utente: v.utente.trim() } : {}), ...(v.chiave ? { chiave: v.chiave } : {}), ...(v.desktopId ? { desktop_id: v.desktopId } : {}),
});
const daMacchina = (m: Macchina): ValoriMacchina => ({ host: m.host, porta: String(m.porta), utente: m.utente, chiave: m.chiave ?? "", nome: m.nome, cartella: m.cartella, desktopId: null });

/** Stati di prova delle scene (chiave `dialogo` della sezione): la corsa già partita, com'era al frame del disegno. */
const PROVE: Record<string, { corsa?: boolean; esito?: "ok" | "rifiutato"; ripreso?: string; nome?: string }> = {
  vuoto: {}, proposta: {}, nome: { nome: "Build Server" }, preparazione: { corsa: true }, fallito: { corsa: true, esito: "rifiutato" }, login: { corsa: true, esito: "rifiutato" },
  pronta: { corsa: true, esito: "ok" }, ripresa: { corsa: true, ripreso: "claude" }, github: { corsa: true },
};

export function DialogoMacchina({ proposte, proposta = null, macchina = null, prova, onChiudi, onFatto, onNuovaSessione }: {
  proposte: Proposta[]; proposta?: Proposta | null; macchina?: Macchina | null; prova?: string | null;
  onChiudi(): void; onFatto(): void; onNuovaSessione(nome: string): void;
}) {
  const p = prova ? PROVE[prova] : undefined;
  const { dati } = useRegistro();
  const [v, setV] = useState<ValoriMacchina>(() => {
    const base = macchina ? daMacchina(macchina) : proposta ? daProposta(proposta, VUOTI) : VUOTI;
    return p?.nome ? { ...base, nome: p.nome } : prova === "vuoto" ? VUOTI : base;
  });
  const [fase, setFase] = useState<"form" | "prep">(macchina || p?.corsa ? "prep" : "form");
  const [corsa, setCorsa] = useState<{ da: number; ripreso: { passo: string; t: number } | null } | null>(p?.corsa ? { da: 0, ripreso: p.ripreso ? { passo: p.ripreso, t: 0 } : null } : null);
  const [esito, setEsito] = useState<EsitoComando | null>(p?.esito ? { id: "c", esito: p.esito, testo: "" } : null);
  const [errore, setErrore] = useState<string | null>(null);
  const [provato, setProvato] = useState(false);
  const eventi = dati?.passiMacchina ?? [], ultimi = useRef(eventi); // gli eventi arrivano mentre il comando aspetta: la risposta li legge da qui, non dalla copia di quando è partito
  ultimi.current = eventi;
  const lavora = !!corsa && !esito, pronta = esito?.esito === "ok";

  const righe = righePassi({ nome: v.nome, cartella: v.cartella, eventi, da: corsa?.da ?? Infinity, ripreso: corsa?.ripreso, esito: passiDi(esito), fatto: pronta,
    fermata: macchina ? { passo: macchina.passo, testo: macchina.testo, comando: macchina.comando } : null });
  const fermo = passoFermo(righe), mano = righe.find(chiedeMano) ?? null;

  const avvia = async (ripreso: string | null) => {
    const m = mancano(v);
    if (m.host || m.nome || m.cartella) { setProvato(true); return; }
    const da = Date.now();
    setCorsa((c) => ({ da: c?.da ?? da, ripreso: ripreso ? { passo: ripreso, t: da } : null })); setEsito(null); setErrore(null); setFase("prep");
    const e = await comandaEsito("macchina_aggiungi", argomentiAggiungi(v));
    setEsito(e); onFatto();
    // rifiutato prima del primo passo (nome già usato, argomenti sbagliati): si torna al form col perché
    if (e && e.esito !== "ok" && !macchina && !passiDi(e)?.length && !ultimi.current.some((x) => x.nome === v.nome && x.t >= da)) { setFase("form"); setCorsa(null); setEsito(null); setErrore(motivoGuasto(e)); }
  };
  const scegliChiave = () => void window.nuovaSessione.scegliChiave().then((c) => c && setV((x) => ({ ...x, chiave: c })), () => {});
  const chiudi = () => { if (!lavora) onChiudi(); };

  if (fase === "form") {
    return (
      <Dialogo largo centrato titolo="Aggiungi macchina" corpo="Collega una macchina SSH e preparala per le sessioni." onChiudi={chiudi}
        bottoni={<><Bottone tipo="secondario" onClick={onChiudi}>Annulla</Bottone><Bottone tipo="primario" onClick={() => void avvia(null)}>Aggiungi</Bottone></>}>
        <FormMacchina v={v} proposte={proposte} provato={provato} onCambia={(x) => setV((y) => ({ ...y, ...x }))} onProposta={(x) => setV((y) => daProposta(x, y))} onChiave={scegliChiave} />
        {errore && <AvvisoPasso testo={errore} />}
      </Dialogo>
    );
  }
  const github = righe.find((r) => r.stato === "corso" && r.codice);
  const titolo = pronta ? "Macchina pronta" : github ? "Collega GitHub" : "Preparazione";
  const corpo = pronta ? `${v.nome} è pronta per le sessioni.` : `${v.nome} · ${v.utente ? `${v.utente}@` : ""}${v.host}:${v.porta || 22}`;
  const ripreso = corsa?.ripreso ? righe.find((r) => r.passo === corsa.ripreso?.passo)?.etichetta : null;
  const guasto = !lavora && !pronta && !fermo && esito ? motivoGuasto(esito) : null;
  const ripartiDa = fermo?.passo ?? null;
  return (
    <Dialogo largo centrato titolo={titolo} corpo={corpo} onChiudi={chiudi}
      bottoni={lavora ? undefined : pronta
        ? <><Bottone tipo="secondario" onClick={onChiudi}>Chiudi</Bottone><Bottone tipo="primario" onClick={() => onNuovaSessione(v.nome)}>Nuova sessione</Bottone></>
        : <><Bottone tipo="secondario" onClick={onChiudi}>Chiudi</Bottone><Bottone tipo="primario" onClick={() => void avvia(ripartiDa)}>Riprova</Bottone></>}>
      <Passi righe={righe} />
      {github ? <BloccoCodice riga={github} />
        : !lavora && mano?.comando ? <BloccoComando riga={mano} />
        : !lavora && !pronta && (fermo || guasto) ? <AvvisoPasso testo={fermo?.testo ?? guasto ?? ""} />
        : lavora && <span className="nota-passi">{ripreso ? `Riprende da ${ripreso}. ` : ""}Può durare fino a 3 minuti.</span>}
    </Dialogo>
  );
}
