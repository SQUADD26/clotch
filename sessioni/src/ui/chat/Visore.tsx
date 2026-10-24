// figma: 101-28232 — «Visore immagine»: velo sulla finestra, nome e «1 di 2», «Copia», «Salva con nome…», chiudi, frecce tra le immagini del filo.
import { useEffect, useRef, useState } from "react";
import { avvisa, chiudiAvviso } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { Velo } from "../base/Sovrapposto";
import { casella, type VoceGalleria } from "./percorsi";
import { useImmagine } from "./Allegati";
import "./visore.css";

export function Visore({ galleria, indice, onIndice, onChiudi }: { galleria: VoceGalleria[]; indice: number; onIndice(i: number): void; onChiudi(): void }) {
  const v = galleria[indice];
  const [giro, setGiro] = useState(0);
  const url = useImmagine(v?.da ?? null, giro);
  const n = galleria.length;
  const [rotta, setRotta] = useState(false);
  // zoom: 1 = adattata al riquadro; sopra 1 si trascina
  const [zoom, setZoom] = useState(1);
  const [sposta, setSposta] = useState({ x: 0, y: 0 });
  const trascina = useRef<{ x: number; y: number } | null>(null);
  const riquadro = useRef<HTMLDivElement>(null);
  const immagine = useRef<HTMLImageElement>(null);
  const esito = useRef(0); // l'avviso di «Copia»: il nuovo prende il posto del vecchio
  const [copiando, setCopiando] = useState(false);
  // l'immagine non esce dal riquadro: il suo bordo si ferma quando tocca il bordo del riquadro
  const limita = (p: { x: number; y: number }, z: number) => {
    const r = riquadro.current, i = immagine.current;
    if (!r || !i) return p;
    const mx = Math.max(0, (i.offsetWidth * z - r.clientWidth) / 2), my = Math.max(0, (i.offsetHeight * z - r.clientHeight) / 2);
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  };
  const imposta = (z: number) => { const m = Math.min(5, Math.max(1, z)); setZoom(m); setSposta((p) => (m === 1 ? { x: 0, y: 0 } : limita(p, m))); };
  const muovi = (dx: number, dy: number) => setSposta((p) => limita({ x: p.x + dx, y: p.y + dy }, zoom));
  useEffect(() => { setRotta(false); imposta(1); }, [indice]);
  const riprova = () => { setRotta(false); setGiro((g) => g + 1); };
  const vai = (d: number) => onIndice((indice + d + n) % n);
  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      const passo = 40; // con l'immagine ingrandita le frecce la spostano; il cambio immagine resta sui bottoni
      if (zoom > 1 && e.key.startsWith("Arrow")) muovi(e.key === "ArrowLeft" ? passo : e.key === "ArrowRight" ? -passo : 0, e.key === "ArrowUp" ? passo : e.key === "ArrowDown" ? -passo : 0);
      else if (e.key === "ArrowLeft" && n > 1) vai(-1);
      else if (e.key === "ArrowRight" && n > 1) vai(1);
      else if (e.key === "+" || e.key === "=") imposta(zoom * 1.5);
      else if (e.key === "-") imposta(zoom / 1.5);
      else if (e.key === "0") imposta(1);
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", tasto);
    return () => removeEventListener("keydown", tasto);
  });
  if (!v) return null;
  const copia = async () => {
    setCopiando(true);
    const ok = await casella().copiaImmagine(v.da).catch(() => false);
    setCopiando(false);
    chiudiAvviso(esito.current);
    esito.current = avvisa(ok ? { tipo: "successo", messaggio: "Immagine copiata" } : { tipo: "errore", messaggio: "Immagine non copiata" });
  };
  const salva = async () => { if (await casella().salvaImmagine(v.da, v.nome).catch(() => false)) avvisa({ tipo: "successo", messaggio: "Immagine salvata" }); };
  // il velo comune (base/Sovrapposto) sta in fondo al body: il filo ha `content-visibility`, che lo chiuderebbe dentro la colonna; Esc e fuoco che torna sono suoi
  return (
    <Velo className="visore-velo" onChiudi={onChiudi}>
      {n > 1 && <button type="button" className="freccia" onClick={() => vai(-1)} aria-label="Immagine precedente"><Icona nome="indietro" colore="primaria" /></button>}
      <div className="visore" role="dialog" aria-modal="true" aria-label={v.nome}>
        <div className="barra-visore">
          <span className="nome t-sm">{v.nome} {indice + 1} di {n}</span>
          <Bottone tipo="secondario" disabled={copiando} onClick={copia}>Copia</Bottone>
          <Bottone tipo="secondario" onClick={salva}>Salva con nome…</Bottone>
          <button type="button" className="chiudi" autoFocus onClick={onChiudi} aria-label="Chiudi"><Icona nome="chiudi" colore="primaria" /></button>
        </div>
        <div ref={riquadro} tabIndex={-1} className={`immagine-visore${url === undefined ? " carico" : ""}`} data-zoom={zoom > 1 ? "su" : "giu"}
          onWheel={(e) => { if (e.ctrlKey) imposta(zoom * (e.deltaY < 0 ? 1.25 : 0.8)); }}
          onDoubleClick={() => imposta(zoom > 1 ? 1 : 2)}
          onPointerDown={(e) => { if (zoom > 1) { trascina.current = { x: e.clientX - sposta.x, y: e.clientY - sposta.y }; e.currentTarget.setPointerCapture(e.pointerId); } }}
          onPointerMove={(e) => { if (trascina.current) setSposta(limita({ x: e.clientX - trascina.current.x, y: e.clientY - trascina.current.y }, zoom)); }}
          onPointerUp={() => { trascina.current = null; }}>
          {url && !rotta ? <img ref={immagine} src={url} alt={v.nome} draggable={false} style={{ transform: `translate(${sposta.x}px, ${sposta.y}px) scale(${zoom})` }} onError={() => setRotta(true)} />
            : url === null || rotta ? <div className="non-letta"><Icona nome="immagine" colore="terziaria" /><span className="t-sm secondario">Immagine non letta</span><Bottone tipo="secondario" onClick={riprova}>Riprova</Bottone></div> : null}
        </div>
      </div>
      {n > 1 && <button type="button" className="freccia" onClick={() => vai(1)} aria-label="Immagine successiva"><Icona nome="avanti" colore="primaria" /></button>}
    </Velo>
  );
}
