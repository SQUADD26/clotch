// figma: 101-7728 — barra laterale (#348): comandi, clotch AI, filtri, elenco per cartelle, piede. Stati: vuoto 101:8772,
// caricamento 101:8824, errore cartella 101:8931, 200 sessioni 101:9109, titolo lunghissimo 101:9359.
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import caricamento from "../../../design/figma/101-8824.json";
import { Bottone } from "../base/Bottone";
import { api, useElenco, usePreferenze } from "../base/dati";
import { Icona } from "../base/Icona";
import { useImpostazioni } from "../impostazioni/stato";
import { registraAzione } from "../base/scorciatoie";
import { useNavigazione } from "../base/navigazione";
import { numero } from "../base/token";
import { useOra } from "../chat/clotch-ai";
import { useApriSessione } from "./apri";
import { conFiglie } from "./figlie";
import { componi, dettaglioProfilo, numeroAccount, opzioni, type Proprieta, type Vista } from "./elenco";
import { MenuOpzioni, MenuProprieta, MenuRaggruppa, Pillole } from "./Filtri";
import { RigheClotchAi, useRegistro } from "./ClotchAi";
import { AccountBarra } from "./Account";
import { MenuCartella, MenuProfilo, MenuRiga } from "./Menu";
import { prova } from "./prova";
import { copiaUltimoBlocco } from "./Ricerca";
import { impostaRicerca, useRicercaAperta } from "./RicercaGlobale";
import { RigaCartella, RigaComando, RigaSessione, TitoloSezione } from "./Righe";
import { SceltaIcona } from "./SceltaIcona";
import { APezzi } from "./APezzi";
import { accanto } from "./Sovrapposti";
import { archivia } from "./esiti";
import { Sovrapposto, type Ancora, type Punto } from "../base/Sovrapposto";
import { conTransizione } from "../base/movimento";
import { nonRisponde } from "../chat/clotch-ai";

export type Aperto =
  | { tipo: "opzioni"; i: number; a: Ancora } | { tipo: "proprieta"; a: Ancora } | { tipo: "raggruppa"; a: Ancora }
  | { tipo: "icona"; id: string; a: Ancora } | { tipo: "riga"; id: string; a: Ancora }
  | { tipo: "cartella"; chiave: string; a: Ancora } | { tipo: "profilo"; a: Ancora };

const sagome = (caricamento.nodi as { nome: string; box: { w: number } }[]).filter((n) => n.nome === "sagoma").map((n) => n.box.w);
/** Clic destro: sul puntatore. Clic sul «⋯» o tasto dei menu (senza puntatore, `detail` 0): sotto il bottone o la riga (#718). */
const dove = (e: MouseEvent): Ancora => e.type === "contextmenu" && (e.detail > 0 || e.clientX || e.clientY) ? { x: e.clientX, y: e.clientY } : e.currentTarget as Element;

// Lo stato di elenco sopravvive allo smontaggio della Barra (impostazioni, barra laterale chiusa).
const conservato = { vista: { filtri: [], raggruppa: "cartella", ordina: "attivita" } as Vista, chiuse: new Set<string>(), aperteAMano: new Set<string>() };

export default function Barra() {
  const n = useNavigazione();
  const apriSessione = useApriSessione();
  const { scorciatoie: { cerca: tastoCerca }, etichetteCartelle } = useImpostazioni();
  const etichetta = (g: { chiave: string; titolo: string }) => etichetteCartelle[g.chiave] ?? g.titolo;
  const p = prova();
  const vivo = useElenco();
  const prefVive = usePreferenze();
  const registroVivo = useRegistro();
  const elenco = p?.elenco ?? vivo;
  const pref = p?.pref ?? prefVive.dati;
  const registro = p ? p.registro : registroVivo;
  // ora che scorre ogni 30 s, non a ogni render: con Date.now() `componi` si rifaceva a ogni passaggio del mouse (#474)
  const ora = useOra();
  const adesso = p?.ora ?? ora;
  const sessioni = elenco.dati?.sessioni ?? [];

  const [vista, setVistaSubito] = useState<Vista>(p?.vista ?? conservato.vista);
  const setVista = (v: Vista) => conTransizione(() => setVistaSubito(v)); // filtri, raggruppa, ordina: le righe entrano ed escono (#520)
  const [aperto, setAperto] = useState<Aperto | null>(p?.aperto ?? null);
  const ricerca = useRicercaAperta();
  const [chiuse, setChiuse] = useState<Set<string>>(conservato.chiuse);
  const [suggerimento, setSuggerimento] = useState<{ testo: string; a: Punto } | null>(p?.suggerimento ?? null);
  const barra = useMemo(() => componi(sessioni, vista, pref, adesso), [sessioni, vista, pref, adesso]);
  const pagina = p?.pagina ?? n.vista;
  const scelta = pagina === "sessione" ? (p?.scelta ?? n.sessione) : null;
  // aperta: la cartella della sessione scelta, quelle aperte a mano e (con un filtro attivo) quelle con i risultati; chiuse a mano restano chiuse
  const filtrato = vista.filtri.some((f) => f.valori.length);
  const [aperteAMano, setAperteAMano] = useState<Set<string>>(p ? new Set(p.aperte ?? []) : conservato.aperteAMano);
  useEffect(() => { if (!p) Object.assign(conservato, { vista, chiuse, aperteAMano }); }, [p, vista, chiuse, aperteAMano]);
  // la cartella della sessione scelta, calcolata una volta per render (prima: ogni cartella riscorreva tutte le cartelle, #474)
  const conScelta = useMemo(() => barra.gruppi.find((g) => g.sessioni.some((s) => s.id === scelta))?.chiave, [barra, scelta]);
  const aperta = (chiave: string) => !chiuse.has(chiave) && (aperteAMano.has(chiave) || filtrato || chiave === conScelta);
  const alterna = (chiave: string) => {
    const ora = aperta(chiave);
    conTransizione(() => {
      setChiuse((c) => { const x = new Set(c); if (ora) x.add(chiave); else x.delete(chiave); return x; });
      setAperteAMano((c) => { const x = new Set(c); if (ora) x.delete(chiave); else x.add(chiave); return x; });
    });
  };

  useEffect(() => { // ⇧⌘A e ⇧⌘;: azioni del gestore unico (base/scorciatoie), con le sue regole
    const id = n.sessione;
    if (!id) return;
    const fuori = [registraAzione("archivia", () => void archivia([id])), registraAzione("copiaBlocco", () => void copiaUltimoBlocco(id))];
    return () => fuori.forEach((f) => f());
  }, [n.sessione]);
  // frecce su e giù nella lista: il fuoco passa alla riga dopo e a quella prima (comandi, cartelle e sessioni).
  // → e ← come un albero del Mac (#836): aprono e chiudono cartella o figlie; ← su una riga chiusa sale al genitore.
  useEffect(() => {
    const frecce = (e: KeyboardEvent) => {
      if (!e.key.startsWith("Arrow") || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return; // ⌃↑ ⌃↓ sono delle sessioni (dialoghi/)
      const t = e.target as HTMLElement;
      if (!t.matches?.(".pezzo-barra .riga:not(.titolo-sezione)")) return;
      const righe = [...document.querySelectorAll<HTMLElement>(".pezzo-barra .riga:not(.titolo-sezione)")].filter((x) => x.getClientRects().length);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const apre = e.key === "ArrowRight";
        const leva = t.hasAttribute("aria-expanded") ? t : t.querySelector<HTMLElement>(":scope > .freccia-figlie");
        const genitore = t.dataset.figlia
          ? righe.slice(0, righe.indexOf(t)).reverse().find((x) => x.querySelector(":scope > .freccia-figlie"))
          : t.closest(".gruppo")?.querySelector<HTMLElement>(":scope > .riga[aria-expanded]");
        if (leva && (leva.getAttribute("aria-expanded") === "true") !== apre) leva.click();
        else if (!apre && genitore && genitore !== t) genitore.focus();
        else if (apre && leva) righe[righe.indexOf(t) + 1]?.focus();
        else return;
        e.preventDefault();
        return;
      }
      const dopo = righe[righe.indexOf(t) + (e.key === "ArrowDown" ? 1 : -1)];
      if (dopo) { e.preventDefault(); dopo.focus(); }
    };
    addEventListener("keydown", frecce);
    return () => removeEventListener("keydown", frecce);
  }, []);

  const filtri = vista.filtri;
  // una pillola rimasta senza valori non filtra niente: alla chiusura del menu si toglie da sola
  const chiudi = () => { setAperto(null); setVistaSubito((v) => (v.filtri.some((f) => !f.valori.length) ? { ...v, filtri: v.filtri.filter((f) => f.valori.length) } : v)); }; // sull'ultimo stato: la transizione di setVista arriva dopo
  const aggiungiFiltro = (prop: Proprieta) => {
    const i = filtri.findIndex((f) => f.proprieta === prop);
    // subito, senza transizione: il filtro è vuoto (le righe non cambiano) e il suo menu delle opzioni lo legge ora
    if (i < 0) setVistaSubito({ ...vista, filtri: [...filtri, { proprieta: prop, valori: [] }] });
    setAperto({ tipo: "opzioni", i: i < 0 ? filtri.length : i, a: aperto!.a });
  };
  const suTroncato = (testo: string | null, el?: HTMLElement) => {
    if (!testo || !el) return setSuggerimento(null);
    const r = el.getBoundingClientRect();
    setSuggerimento({ testo, a: { x: r.left - numero("spazio-2"), y: r.bottom + numero("spazio-3") } });
  };
  // tolto un filtro il fuoco passa alla pillola vicina, poi a «+ Filtro», poi a «Filtra»: la tastiera non perde il posto (#930)
  const tolto = useRef<number | null>(null);
  useEffect(() => {
    if (tolto.current === null) return;
    const x = [...document.querySelectorAll<HTMLElement>(".pezzo-barra .pillole .togli")];
    (x[Math.min(tolto.current, x.length - 1)] ?? document.querySelector<HTMLElement>(".pezzo-barra .pillole .aggiungi") ?? document.querySelector<HTMLElement>('.pezzo-barra [data-comando="Filtra"]'))?.focus();
    tolto.current = null;
  }, [filtri]);
  const attivi = filtri.filter((f) => f.valori.length).length;
  const sessione = (id: string) => sessioni.find((s) => s.id === id);

  const [figlieChiuse, setFiglieChiuse] = useState<Set<string>>(new Set());
  const alternaFiglie = (id: string) => conTransizione(() => setFiglieChiuse((c) => { const x = new Set(c); if (!x.delete(id)) x.add(id); return x; }));
  // le righe sono memo (Righe.tsx) e ignorano le funzioni: queste chiamano sempre l'ultima versione, via ref
  const vivi = useRef({ apriSessione, pref, alterna });
  vivi.current = { apriSessione, pref, alterna };
  // un registro che cambia ridisegna solo le righe il cui «non risponde» cambia (le righe sono memo, #1017 in raffica)
  const muta = (id: string) => { const c = registroVivo?.chat.get(id); return !!c && nonRisponde(c, Date.now()); };
  const righe = (lista: typeof sessioni, fissate = false) => (fissate ? lista.map((s) => ({ s, figlia: false, figlie: 0 })) : conFiglie(lista, figlieChiuse)).map(({ s, figlia, figlie }) => (
    <RigaSessione
      key={s.id} s={s} muta={muta(s.id)} pref={pref[s.id]} scelta={!fissate && s.id === scelta} fissata={fissate} passaggio={!fissate && p?.passaggio === s.id}
      figlia={figlia} figlie={figlie} figlieAperte={!figlieChiuse.has(s.id)} onFiglie={() => alternaFiglie(s.id)}
      onApri={() => { vivi.current.apriSessione(s.id); if (vivi.current.pref[s.id]?.nonLetta) void api().impostaPreferenze(s.id, { nonLetta: null }); }}
      onIcona={(e) => setAperto({ tipo: "icona", id: s.id, a: accanto(e.currentTarget, numero("spazio-1")) })}
      onFissa={() => void api().impostaPreferenze(s.id, { fissa: vivi.current.pref[s.id]?.fissa ? null : true })}
      onMenu={(e) => { e.preventDefault(); setAperto({ tipo: "riga", id: s.id, a: dove(e) }); }}
      onTroncato={suTroncato}
    />
  ));

  return (
    <>
      <RigaComando icona="piu" etichetta="Nuova sessione" tasto="⌘N" scelta={pagina === "nuova-sessione"} onClick={() => n.apri("nuova-sessione")} />
      <RigaComando icona="cerca" etichetta="Cerca sessioni" tasto={tastoCerca ?? undefined} onClick={() => impostaRicerca(true)} />
      <RigaComando icona="filtra" etichetta="Filtra" lato={attivi ? `${attivi} ${attivi === 1 ? "attivo" : "attivi"}` : undefined}
        onClick={(e) => setAperto({ tipo: "raggruppa", a: accanto(e.currentTarget, -numero("spazio-1")) })} />
      <RigheClotchAi r={registro} adesso={adesso} pagina={pagina} />
      <Pillole filtri={filtri} onApri={(i, e) => setAperto({ tipo: "opzioni", i, a: accanto(e.currentTarget, numero("spazio-1")) })}
        onAggiungi={(e) => setAperto({ tipo: "proprieta", a: accanto(e.currentTarget, numero("spazio-1")) })}
        onTogli={(i) => { tolto.current = i; setVista({ ...vista, filtri: filtri.filter((_, k) => k !== i) }); }} />

      {elenco.stato === "carica" && !elenco.dati ? (
        <div className="elenco" aria-busy="true">
          {sagome.map((w, i) => <div key={i} className="riga"><div className="sagoma" style={{ width: w }} /></div>)}
        </div>
      ) : !sessioni.length && !elenco.errore ? (
        <div className="elenco vuoto t-sm secondario">Nessuna sessione</div>
      ) : (
        <div className="elenco" onScroll={() => setSuggerimento(null)}>
          {elenco.errore && !elenco.dati && (
            <div className="avviso-cartella">
              <Icona nome="avviso" colore="errore" />
              <div className="testi"><span className="t-sm secondario">{elenco.errore}</span><Bottone tipo="secondario" onClick={elenco.riprova}>Riprova</Bottone></div>
            </div>
          )}
          {elenco.dati?.errori.map((e) => (
            <div key={e.percorso} className="avviso-cartella">
              <Icona nome="avviso" colore="errore" />
              <div className="testi">
                <span className="medio">Cartella non leggibile</span>
                <span className="t-sm secondario">{e.percorso}: {e.messaggio}. Le altre cartelle sono lette.</span>
              </div>
            </div>
          ))}
          {!!barra.fissate.length && <><TitoloSezione>Fissate</TitoloSezione>{righe(barra.fissate, true)}</>}
          {!!sessioni.length && <TitoloSezione>{barra.titolo}</TitoloSezione>}
          {!!sessioni.length && !barra.totale && (
            <div className="vuoto-filtri">
              <span className="t-sm secondario">Nessuna sessione con questi filtri</span>
              <Bottone tipo="secondario" onClick={() => { tolto.current = -1; setVista({ ...vista, filtri: [] }); }}>Rimuovi filtri</Bottone>
            </div>
          )}
          <APezzi n={barra.gruppi.length} subito={!!p} figli={(q) => barra.gruppi.slice(0, q).map((g) => vista.raggruppa === "cartella" ? (
            <div key={g.chiave} className="gruppo">
              <RigaCartella nome={etichetta(g)} conteggio={g.sessioni.length} aperta={!!aperta(g.chiave)} onClick={() => vivi.current.alterna(g.chiave)}
                onMenu={(e) => { e.preventDefault(); setAperto({ tipo: "cartella", chiave: g.chiave, a: dove(e) }); }} onTroncato={suTroncato} />
              {aperta(g.chiave) && <div className="sessioni-gruppo"><APezzi n={g.sessioni.length} subito={!!p} figli={(k) => righe(g.sessioni).slice(0, k)} /></div>}
            </div>
          ) : (
            <div key={g.chiave} className="gruppo"><TitoloSezione>{g.titolo}</TitoloSezione><APezzi n={g.sessioni.length} subito={!!p} figli={(k) => righe(g.sessioni).slice(0, k)} /></div>
          ))} />
        </div>
      )}

      <AccountBarra conta={numeroAccount(sessioni)} prova={p?.account}
        onApre={() => aperto?.tipo === "profilo" && chiudi()}
        onAltro={(e) => setAperto(aperto?.tipo === "profilo" ? null : { tipo: "profilo", a: e.currentTarget.closest(".piede-account")! })} />

      {aperto?.tipo === "raggruppa" && (
        <MenuRaggruppa a={aperto.a} raggruppa={vista.raggruppa} ordina={vista.ordina} onChiudi={chiudi}
          onRaggruppa={(r) => setVista({ ...vista, raggruppa: r })} onOrdina={(o) => setVista({ ...vista, ordina: o })}
          onAggiungi={() => setAperto({ tipo: "proprieta", a: aperto.a })} />
      )}
      {aperto?.tipo === "proprieta" && <MenuProprieta a={aperto.a} onScegli={aggiungiFiltro} onChiudi={chiudi} />}
      {aperto?.tipo === "opzioni" && filtri[aperto.i] && (
        <MenuOpzioni a={aperto.a} filtro={filtri[aperto.i]} opzioni={opzioni(sessioni, filtri[aperto.i].proprieta, adesso)} onChiudi={chiudi}
          onCambia={(valori) => setVista({ ...vista, filtri: filtri.map((f, i) => (i === aperto.i ? { ...f, valori } : f)) })}
          onRimuovi={() => { setVista({ ...vista, filtri: filtri.filter((_, i) => i !== aperto.i) }); chiudi(); }} />
      )}
      {aperto?.tipo === "icona" && <SceltaIcona a={aperto.a} pref={pref[aperto.id]} onChiudi={chiudi} onImposta={(x) => void api().impostaPreferenze(aperto.id, x)} />}
      {aperto?.tipo === "riga" && sessione(aperto.id) && <MenuRiga s={sessione(aperto.id)!} pref={pref[aperto.id]} a={aperto.a} inizio={p?.voce} onChiudi={chiudi} />}
      {aperto?.tipo === "cartella" && barra.gruppi.find((g) => g.chiave === aperto.chiave) && (
        <MenuCartella sessioni={barra.gruppi.find((g) => g.chiave === aperto.chiave)!.sessioni} chiave={aperto.chiave} etichetta={etichetta(barra.gruppi.find((g) => g.chiave === aperto.chiave)!)}
          a={aperto.a} inizio={p?.voce} onChiudi={chiudi} />
      )}
      {aperto?.tipo === "profilo" && <MenuProfilo dettaglio={dettaglioProfilo(sessioni)} a={aperto.a} inizio={p?.voce} onChiudi={chiudi} onImpostazioni={() => n.apri("impostazioni")} />}
      {suggerimento && !aperto && !ricerca && <Sovrapposto passivo ancora={suggerimento.a} className="suggerimento t-xs" role="tooltip">{suggerimento.testo}</Sovrapposto>}
    </>
  );
}
