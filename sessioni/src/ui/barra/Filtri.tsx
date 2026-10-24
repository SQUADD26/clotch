// figma: 101-9860 — filtri stile Notion: pillole (101:9860), menu delle opzioni (101:16778), menu «Aggiungi filtro» (101:17031),
// «Raggruppa per» / «Ordina per» (101:30304).
import { useState, type MouseEvent } from "react";
import { Icona } from "../base/Icona";
import { PROPRIETA, pillola, type Filtro, type Opzione, type Ordina, type Proprieta, type Raggruppa } from "./elenco";
import { Sovrapposto, type Ancora } from "../base/Sovrapposto";
import "./filtri.css";

export function Pillole({ filtri, onApri, onAggiungi, onTogli }: { filtri: Filtro[]; onApri(i: number, e: MouseEvent): void; onAggiungi(e: MouseEvent): void; onTogli(i: number): void }) {
  if (!filtri.length) return null;
  return (
    <div className="pillole">
      {filtri.map((f, i) => {
        const p = pillola(f);
        return (
          <span key={f.proprieta} className="pillola-filtro t-sm">
            <button type="button" className="apri" aria-haspopup="menu" onClick={(e) => onApri(i, e)}>
              <span className="secondario">{p.proprieta}</span>
              <span className="valore medio" title={p.valore}>{p.valore}</span>
              <Icona nome="giu" />
            </button>
            <button type="button" className="togli" aria-label={`Rimuovi filtro ${p.proprieta.replace(":", "")}`} onClick={() => onTogli(i)}><Icona nome="chiudi" /></button>
          </span>
        );
      })}
      <button type="button" className="pillola-filtro aggiungi t-sm" aria-haspopup="menu" onClick={onAggiungi}>
        <Icona nome="piu" />
        <span className="secondario">Filtro</span>
      </button>
    </div>
  );
}

function CercaNelMenu({ segnaposto, valore, onCambia }: { segnaposto: string; valore: string; onCambia(v: string): void }) {
  return (
    <label className="campo-menu">
      <Icona nome="cerca" colore="terziaria" />
      <input className="t-sm" placeholder={segnaposto} value={valore} autoFocus onChange={(e) => onCambia(e.target.value)} />
    </label>
  );
}

/** Tastiera dei menu: frecce (e Tab) tra campo e voci, il fuoco entra sulla prima voce se non c'è un campo. */
const frecce = (primaVoce = false) => (el: HTMLDivElement | null) => {
  if (!el) return;
  if (primaVoce) el.querySelector<HTMLElement>(".voce")?.focus();
  el.addEventListener("keydown", (e) => {
    const verso = e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey) ? 1 : e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey) ? -1 : 0;
    if (!verso) return;
    const v = [...el.querySelectorAll<HTMLElement>("input, button")];
    const i = v.indexOf(document.activeElement as HTMLElement);
    v[(i + verso + v.length) % v.length]?.focus();
    e.preventDefault();
  });
};

const Vuoto = ({ testo }: { testo: string }) => <div className="vuoto-menu t-sm secondario">{testo}</div>;
const cerca = (testo: string, q: string) => testo.toLowerCase().includes(q.trim().toLowerCase());

/** «Menu filtro» Tipo=Proprietà: scegli su cosa filtrare. */
export function MenuProprieta({ a, onScegli, onChiudi }: { a: Ancora; onScegli(p: Proprieta): void; onChiudi(): void }) {
  const [q, setQ] = useState("");
  return (
    <Sovrapposto ancora={a} className="menu menu-filtro" role="menu" label="Aggiungi filtro" rif={frecce()} onChiudi={onChiudi}>
      <CercaNelMenu segnaposto="Cerca proprietà" valore={q} onCambia={setQ} />
      {!PROPRIETA.some((p) => cerca(p.etichetta, q)) && <Vuoto testo="Nessuna proprietà" />}
      {PROPRIETA.filter((p) => cerca(p.etichetta, q)).map((p) => (
        <button key={p.chiave} type="button" role="menuitem" className="voce" onClick={() => onScegli(p.chiave)}>
          <Icona nome={p.icona} />
          <span className="etichetta t-sm">{p.etichetta}</span>
        </button>
      ))}
    </Sovrapposto>
  );
}

/** «Menu filtro» Tipo=Opzioni: caselle da spuntare e «Rimuovi filtro». */
export function MenuOpzioni({ a, filtro, opzioni, onCambia, onRimuovi, onChiudi }: {
  a: Ancora; filtro: Filtro; opzioni: Opzione[];
  onCambia(valori: string[]): void; onRimuovi(): void; onChiudi(): void;
}) {
  const [q, setQ] = useState("");
  const etichetta = PROPRIETA.find((p) => p.chiave === filtro.proprieta)!.etichetta;
  const alterna = (v: string) => onCambia(filtro.valori.includes(v) ? filtro.valori.filter((x) => x !== v) : [...filtro.valori, v]);
  return (
    <Sovrapposto ancora={a} className="menu menu-filtro" role="menu" label={`Filtro ${etichetta}`} rif={frecce()} onChiudi={onChiudi}>
      <div className="testata t-sm secondario">
        <span className="medio">{etichetta}</span>
        <span>è</span>
        <Icona nome="giu" />
      </div>
      <CercaNelMenu segnaposto="Cerca opzione" valore={q} onCambia={setQ} />
      {!opzioni.some((o) => cerca(o.voce, q)) && <Vuoto testo="Nessuna opzione" />}
      {opzioni.filter((o) => cerca(o.voce, q)).map((o) => {
        const spuntata = filtro.valori.includes(o.chiave);
        return (
          <button key={o.chiave} type="button" role="menuitemcheckbox" aria-checked={spuntata} className="voce" onClick={() => alterna(o.chiave)}>
            <span className={`casella-spunta ${spuntata ? "spuntata" : ""}`}>{spuntata && <Icona nome="spunta" colore="su-accento" />}</span>
            {o.icona && <Icona nome={o.icona} colore={o.colore} />}
            <span className="etichetta t-sm">{o.voce}</span>
          </button>
        );
      })}
      <div className="linea" />
      <button type="button" role="menuitem" className="voce" onClick={onRimuovi}>
        <span className="etichetta t-sm pericolo">Rimuovi filtro</span>
      </button>
    </Sovrapposto>
  );
}

const RAGGRUPPA: { chiave: Raggruppa; etichetta: string }[] = [
  { chiave: "cartella", etichetta: "Cartella" }, { chiave: "data", etichetta: "Data" }, { chiave: "sorgente", etichetta: "Sorgente" },
];
const ORDINA: { chiave: Ordina; etichetta: string }[] = [{ chiave: "attivita", etichetta: "Ultima attività" }, { chiave: "nome", etichetta: "Nome" }];

function Scelta({ etichetta, scelta, onClick }: { etichetta: string; scelta: boolean; onClick(): void }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={scelta} className="voce" onClick={onClick}>
      <span className={scelta ? "spunta" : "spunta nascosta"}><Icona nome="spunta" colore="primaria" /></span>
      <span className="etichetta t-sm">{etichetta}</span>
    </button>
  );
}

/** Menu di «Filtra»: raggruppa, ordina, aggiungi filtro (101:30304). */
export function MenuRaggruppa({ a, raggruppa, ordina, onRaggruppa, onOrdina, onAggiungi, onChiudi }: {
  a: Ancora; raggruppa: Raggruppa; ordina: Ordina;
  onRaggruppa(r: Raggruppa): void; onOrdina(o: Ordina): void; onAggiungi(e: MouseEvent): void; onChiudi(): void;
}) {
  return (
    <Sovrapposto ancora={a} className="menu menu-raggruppa" role="menu" label="Filtra" rif={frecce(true)} onChiudi={onChiudi}>
      <div className="titolo-gruppo t-xs medio secondario">Raggruppa per</div>
      {RAGGRUPPA.map((r) => <Scelta key={r.chiave} etichetta={r.etichetta} scelta={raggruppa === r.chiave} onClick={() => onRaggruppa(r.chiave)} />)}
      <div className="separatore"><div className="linea" /></div>
      <div className="titolo-gruppo t-xs medio secondario">Ordina per</div>
      {ORDINA.map((o) => <Scelta key={o.chiave} etichetta={o.etichetta} scelta={ordina === o.chiave} onClick={() => onOrdina(o.chiave)} />)}
      <div className="separatore"><div className="linea" /></div>
      <button type="button" role="menuitem" className="voce" onClick={onAggiungi}>
        <Icona nome="piu" />
        <span className="etichetta t-sm">Aggiungi filtro</span>
        <Icona nome="destra" />
      </button>
    </Sovrapposto>
  );
}
