// figma: 101-7728 — barra laterale (#348): comandi, Friday, filtri, elenco per cartelle, piede. Stati: vuoto 101:8772,
// caricamento 101:8824, errore cartella 101:8931, 200 sessioni 101:9109, titolo lunghissimo 101:9359.
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import caricamento from "../../../design/figma/101-8824.json";
import { Bottone } from "../base/Bottone";
import { api, useElenco, usePreferenze } from "../base/dati";
import { Icona } from "../base/Icona";
import { useImpostazioni } from "../impostazioni/stato";
import { registraAzione } from "../base/scorciatoie";
import { useNavigazione } from "../base/navigazione";
import { numero } from "../base/token";
import { useApriSessione } from "./apri";
import { componi, dettaglioProfilo, opzioni, type Proprieta, type Vista } from "./elenco";
import { MenuOpzioni, MenuProprieta, MenuRaggruppa, Pillole } from "./Filtri";
import { RigheFriday, useRegistro } from "./Friday";
import { MenuCartella, MenuProfilo, MenuRiga } from "./Menu";
import { prova } from "./prova";
import { copiaUltimoBlocco, Ricerca } from "./Ricerca";
import { Piede, RigaCartella, RigaComando, RigaSessione, TitoloSezione } from "./Righe";
import { SceltaIcona } from "./SceltaIcona";
import { accanto, type Punto } from "./Sovrapposti";

export type Aperto =
  | { tipo: "opzioni"; i: number; a: Punto } | { tipo: "proprieta"; a: Punto } | { tipo: "raggruppa"; a: Punto }
  | { tipo: "icona"; id: string; a: Punto } | { tipo: "riga"; id: string; a: Punto }
  | { tipo: "cartella"; chiave: string; a: Punto } | { tipo: "profilo"; a: Punto };

const sagome = (caricamento.nodi as { nome: string; box: { w: number } }[]).filter((n) => n.nome === "sagoma").map((n) => n.box.w);
const punto = (e: MouseEvent): Punto => ({ x: e.clientX, y: e.clientY });

// Lo stato di elenco sopravvive allo smontaggio della Barra (impostazioni, barra laterale chiusa).
const conservato = { vista: { filtri: [], raggruppa: "cartella", ordina: "attivita" } as Vista, chiuse: new Set<string>(), aperteAMano: new Set<string>() };

export default function Barra() {
  const n = useNavigazione();
  const apriSessione = useApriSessione();
  const tastoCerca = useImpostazioni().scorciatoie.cerca;
  const p = prova();
  const vivo = useElenco();
  const prefVive = usePreferenze();
  const registroVivo = useRegistro();
  const elenco = p?.elenco ?? vivo;
  const pref = p?.pref ?? prefVive.dati;
  const registro = p ? p.registro : registroVivo;
  const adesso = p?.ora ?? Date.now();
  const sessioni = elenco.dati?.sessioni ?? [];

  const [vista, setVista] = useState<Vista>(p?.vista ?? conservato.vista);
  const [aperto, setAperto] = useState<Aperto | null>(p?.aperto ?? null);
  const [ricerca, setRicerca] = useState(p?.ricerca !== undefined);
  const [chiuse, setChiuse] = useState<Set<string>>(conservato.chiuse);
  const [suggerimento, setSuggerimento] = useState<{ testo: string; a: Punto } | null>(p?.suggerimento ?? null);
  const barra = useMemo(() => componi(sessioni, vista, pref, adesso), [sessioni, vista, pref, adesso]);
  const pagina = p?.pagina ?? n.vista;
  const scelta = pagina === "sessione" ? (p?.scelta ?? n.sessione) : null;
  // aperta: la cartella della sessione scelta, quelle aperte a mano e (con un filtro attivo) quelle con i risultati; chiuse a mano restano chiuse
  const filtrato = vista.filtri.some((f) => f.valori.length);
  const [aperteAMano, setAperteAMano] = useState<Set<string>>(p ? new Set(p.aperte ?? []) : conservato.aperteAMano);
  useEffect(() => { if (!p) Object.assign(conservato, { vista, chiuse, aperteAMano }); }, [p, vista, chiuse, aperteAMano]);
  const aperta = (chiave: string) => !chiuse.has(chiave) && (aperteAMano.has(chiave) || filtrato || barra.gruppi.find((g) => g.chiave === chiave)?.sessioni.some((s) => s.id === scelta));
  const alterna = (chiave: string) => {
    const ora = aperta(chiave);
    setChiuse((c) => { const x = new Set(c); if (ora) x.add(chiave); else x.delete(chiave); return x; });
    setAperteAMano((c) => { const x = new Set(c); if (ora) x.delete(chiave); else x.add(chiave); return x; });
  };

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === "a" && n.sessione) { e.preventDefault(); void window.friday.comando("archivia", { chat: n.sessione }); }
      if (e.metaKey && e.shiftKey && e.code === "Semicolon" && n.sessione) { e.preventDefault(); void copiaUltimoBlocco(n.sessione); }
    };
    addEventListener("keydown", tasto);
    return () => removeEventListener("keydown", tasto);
  }, [n.sessione]);
  useEffect(() => registraAzione("cerca", () => setRicerca((x) => !x)), []);

  const chiudi = () => setAperto(null);
  const filtri = vista.filtri;
  const aggiungiFiltro = (prop: Proprieta) => {
    const i = filtri.findIndex((f) => f.proprieta === prop);
    if (i < 0) setVista({ ...vista, filtri: [...filtri, { proprieta: prop, valori: [] }] });
    setAperto({ tipo: "opzioni", i: i < 0 ? filtri.length : i, a: aperto!.a });
  };
  const suTroncato = (testo: string | null, el?: HTMLElement) => {
    if (!testo || !el) return setSuggerimento(null);
    const r = el.getBoundingClientRect();
    setSuggerimento({ testo, a: { x: r.left - numero("spazio-2"), y: r.bottom + numero("spazio-3") } });
  };
  const sessione = (id: string) => sessioni.find((s) => s.id === id);

  const righe = (lista: typeof sessioni, fissate = false) => lista.map((s) => (
    <RigaSessione
      key={s.id} s={s} pref={pref[s.id]} scelta={!fissate && s.id === scelta} fissata={fissate} passaggio={!fissate && p?.passaggio === s.id}
      onApri={() => apriSessione(s.id)}
      onIcona={(e) => setAperto({ tipo: "icona", id: s.id, a: accanto(e.currentTarget, numero("spazio-1")) })}
      onFissa={() => void api().impostaPreferenze(s.id, { fissa: pref[s.id]?.fissa ? null : true })}
      onMenu={(e) => { e.preventDefault(); setAperto({ tipo: "riga", id: s.id, a: punto(e) }); }}
      onTroncato={suTroncato}
    />
  ));

  return (
    <>
      <RigaComando icona="cerca" etichetta="Cerca sessioni" lato={tastoCerca ?? undefined} onClick={() => setRicerca(true)} />
      <RigaComando icona="filtra" etichetta="Filtra" lato={filtri.length ? `${filtri.length} attivi` : undefined}
        onClick={(e) => setAperto({ tipo: "raggruppa", a: accanto(e.currentTarget, -numero("spazio-1")) })} />
      <RigheFriday r={registro} adesso={adesso} pagina={pagina} />
      <Pillole filtri={filtri} onApri={(i, e) => setAperto({ tipo: "opzioni", i, a: accanto(e.currentTarget, numero("spazio-1")) })}
        onAggiungi={(e) => setAperto({ tipo: "proprieta", a: accanto(e.currentTarget, numero("spazio-1")) })} />

      {elenco.stato === "carica" && !elenco.dati ? (
        <div className="elenco" aria-busy="true">
          {sagome.map((w, i) => <div key={i} className="riga"><div className="sagoma" style={{ width: w }} /></div>)}
        </div>
      ) : !sessioni.length && !elenco.errore ? (
        <div className="elenco vuoto t-sm secondario">Le sessioni appaiono qui</div>
      ) : (
        <div className="elenco">
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
          {barra.gruppi.map((g) => vista.raggruppa === "cartella" ? (
            <div key={g.chiave} className="gruppo">
              <RigaCartella nome={g.titolo} conteggio={g.sessioni.length} aperta={!!aperta(g.chiave)} onClick={() => alterna(g.chiave)}
                onMenu={(e) => { e.preventDefault(); setAperto({ tipo: "cartella", chiave: g.chiave, a: punto(e) }); }} />
              {aperta(g.chiave) && <div className="sessioni-gruppo">{righe(g.sessioni)}</div>}
            </div>
          ) : (
            <div key={g.chiave} className="gruppo"><TitoloSezione>{g.titolo}</TitoloSezione>{righe(g.sessioni)}</div>
          ))}
        </div>
      )}

      <Piede dettaglio={dettaglioProfilo(sessioni)} onImpostazioni={() => n.apri("impostazioni")}
        onMenu={(e) => setAperto({ tipo: "profilo", a: { x: e.currentTarget.closest(".piede")!.getBoundingClientRect().left, y: e.currentTarget.closest(".piede")!.getBoundingClientRect().top } })} />

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
      {aperto?.tipo === "riga" && sessione(aperto.id) && <MenuRiga s={sessione(aperto.id)!} pref={pref[aperto.id]} a={aperto.a} onChiudi={chiudi} />}
      {aperto?.tipo === "cartella" && <MenuCartella sessioni={barra.gruppi.find((g) => g.chiave === aperto.chiave)?.sessioni ?? []} a={aperto.a} onChiudi={chiudi} />}
      {aperto?.tipo === "profilo" && <MenuProfilo dettaglio={dettaglioProfilo(sessioni)} a={aperto.a} onChiudi={chiudi} onImpostazioni={() => n.apri("impostazioni")} />}
      {suggerimento && <div className="suggerimento t-xs" style={{ left: suggerimento.a.x, top: suggerimento.a.y }}>{suggerimento.testo}</div>}
      {ricerca && (
        <Ricerca sessioni={sessioni} pref={pref} aperta={scelta} ora={adesso} iniziale={p?.ricerca} cerca={p ? async () => p.cercati ?? [] : undefined}
          onApri={apriSessione} onAzione={(id, a) => void api().azione(id, a)} onChiudi={() => setRicerca(false)} />
      )}
    </>
  );
}
